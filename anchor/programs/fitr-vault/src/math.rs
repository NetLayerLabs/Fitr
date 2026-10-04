//! Pure, unit-testable arithmetic. Every op is checked; every division floors,
//! so the sum of individual payouts can never exceed the pool they are drawn from.
use crate::constants::*;
use crate::error::VaultError;
use anchor_lang::prelude::*;

/// Index of the pool day containing `ts`: floor((ts - offset) / len).
pub fn day_index_at(ts: i64, offset: i64, len: i64) -> Result<u32> {
    require!(len > 0, VaultError::InvalidConfig);
    let t = ts.checked_sub(offset).ok_or(VaultError::MathOverflow)?;
    require!(t >= 0, VaultError::ClockBeforeOffset);
    u32::try_from(t / len).map_err(|_| error!(VaultError::MathOverflow))
}

/// Inclusive start of day `day`: day * len + offset.
pub fn day_start(day: u32, offset: i64, len: i64) -> Result<i64> {
    (day as i64)
        .checked_mul(len)
        .and_then(|v| v.checked_add(offset))
        .ok_or(error!(VaultError::MathOverflow))
}

/// Exclusive end of the day window (== start of next day).
pub fn day_end(day: u32, offset: i64, len: i64) -> Result<i64> {
    day_start(day.checked_add(1).ok_or(VaultError::MathOverflow)?, offset, len)
}

/// Largest allowed commit cutoff: len - len/24 (23 h for a 24 h day), so at least
/// 1/24 of the day always remains to do the workout after the last possible commit.
pub fn max_commit_cutoff(len: i64) -> i64 {
    len - len / 24
}

/// Hard stake ceiling in base units: MAX_STAKE_CEILING_TOKENS * 10^decimals.
pub fn stake_ceiling(decimals: u8) -> Result<u64> {
    require!(decimals <= MAX_MINT_DECIMALS, VaultError::UnsupportedMintDecimals);
    10u64
        .checked_pow(decimals as u32)
        .and_then(|scale| MAX_STAKE_CEILING_TOKENS.checked_mul(scale))
        .ok_or(error!(VaultError::MathOverflow))
}

pub fn bps_of(amount: u64, bps: u16) -> Result<u64> {
    let v = (amount as u128)
        .checked_mul(bps as u128)
        .ok_or(VaultError::MathOverflow)?
        / BPS_DENOM as u128;
    u64::try_from(v).map_err(|_| error!(VaultError::MathOverflow))
}

/// Bonus weight for a completed commitment:
///   amount + floor(min(amount, basis) * boost / 10_000),
///   boost = min((streak - 1) * per_day_bps, max_bps), `streak` including this day.
/// `basis` is the stake completed the day before (UserProfile::record_completion), so a streak
/// built with tiny stakes cannot boost a large one (audit F3). With basis >= amount this equals
/// floor(amount * (10_000 + boost) / 10_000). Goal size never enters the weight.
pub fn weight_for(amount: u64, basis: u64, streak: u16, per_day_bps: u16, max_bps: u16) -> Result<u64> {
    let boost = (streak.saturating_sub(1) as u64)
        .checked_mul(per_day_bps as u64)
        .ok_or(VaultError::MathOverflow)?
        .min(max_bps as u64);
    let boosted = (amount.min(basis) as u128)
        .checked_mul(boost as u128)
        .ok_or(VaultError::MathOverflow)?
        / BPS_DENOM as u128;
    let v = (amount as u128).checked_add(boosted).ok_or(VaultError::MathOverflow)?;
    u64::try_from(v).map_err(|_| error!(VaultError::MathOverflow))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Finalization {
    pub slashed: u64,
    pub fee: u64,
    pub sponsor: u64,
    /// Bonus pool for completers of this day.
    pub distributable: u64,
    /// Net slashed moved to pool.reserve when nobody completed.
    pub to_reserve: u64,
}

/// `revoked_stake` (revoked commitments) is refunded, never forfeited. `sponsor_cap` is the day's
/// DayState snapshot of daily_sponsor_amount.
pub fn finalize_math(
    total_staked: u64,
    completed_stake: u64,
    revoked_stake: u64,
    completed_count: u32,
    fee_bps: u16,
    sponsor_cap: u64,
    reserve: u64,
) -> Result<Finalization> {
    require!(fee_bps as u64 <= BPS_DENOM, VaultError::InvalidConfig);
    let slashed = total_staked
        .checked_sub(completed_stake)
        .and_then(|v| v.checked_sub(revoked_stake))
        .ok_or(VaultError::MathOverflow)?;
    let fee = bps_of(slashed, fee_bps)?;
    let net = slashed.checked_sub(fee).ok_or(VaultError::MathOverflow)?;
    if completed_count == 0 {
        return Ok(Finalization { slashed, fee, sponsor: 0, distributable: 0, to_reserve: net });
    }
    let sponsor = sponsor_cap.min(reserve);
    let distributable = net.checked_add(sponsor).ok_or(VaultError::MathOverflow)?;
    Ok(Finalization { slashed, fee, sponsor, distributable, to_reserve: 0 })
}

/// floor(distributable * weight / total_weight). Sum over all completers <= distributable.
pub fn bonus_share(distributable: u64, weight: u64, total_weight: u64) -> Result<u64> {
    if total_weight == 0 {
        return Ok(0);
    }
    require!(weight <= total_weight, VaultError::MathOverflow);
    let v = (distributable as u128)
        .checked_mul(weight as u128)
        .ok_or(VaultError::MathOverflow)?
        / total_weight as u128;
    u64::try_from(v).map_err(|_| error!(VaultError::MathOverflow))
}

#[cfg(test)]
mod tests {
    use super::*;

    const DAY: i64 = 86_400;

    #[test]
    fn day_windows() {
        // 2026-09-25T00:00:00Z = 1_790_294_400
        let d = day_index_at(1_790_294_400, 0, DAY).unwrap();
        assert_eq!(d, 20_721);
        assert_eq!(day_start(d, 0, DAY).unwrap(), 1_790_294_400);
        assert_eq!(day_end(d, 0, DAY).unwrap(), 1_790_294_400 + 86_400);
        assert_eq!(day_index_at(1_790_294_400 + 86_399, 0, DAY).unwrap(), d);
        assert_eq!(day_index_at(1_790_294_400 + 86_400, 0, DAY).unwrap(), d + 1);
        assert!(day_index_at(-1, 0, DAY).is_err());
    }

    #[test]
    fn day_windows_with_offset_and_short_days() {
        // 600 s days: 1_790_294_400 / 600 = 2_983_824 exactly.
        let d = day_index_at(1_790_294_400, 0, 600).unwrap();
        assert_eq!(d, 2_983_824);
        assert_eq!(day_start(d, 0, 600).unwrap(), 1_790_294_400);
        assert_eq!(day_end(d, 0, 600).unwrap(), 1_790_295_000);
        assert_eq!(day_index_at(1_790_294_999, 0, 600).unwrap(), d);
        assert_eq!(day_index_at(1_790_295_000, 0, 600).unwrap(), d + 1);
        // offset 5 h (UTC-5 midnight = 05:00 UTC): 2026-09-25T04:59:59Z still belongs to day 20720.
        let off = 5 * 3_600;
        assert_eq!(day_index_at(1_790_294_400 + off - 1, off, DAY).unwrap(), 20_720);
        assert_eq!(day_index_at(1_790_294_400 + off, off, DAY).unwrap(), 20_721);
        assert_eq!(day_start(20_721, off, DAY).unwrap(), 1_790_294_400 + off);
        // 300 s days with offset 299
        assert_eq!(day_index_at(299, 299, 300).unwrap(), 0);
        assert!(day_index_at(298, 299, 300).is_err());
        assert_eq!(day_end(0, 299, 300).unwrap(), 599);
        // round trip over many days/lengths: start(index(t)) <= t < end(index(t))
        for len in [300i64, 600, 3_600, 86_400] {
            for off in [0, len / 3, len - 1] {
                for t in (1_790_000_000i64..1_790_000_000 + 3 * len).step_by(97) {
                    let d = day_index_at(t, off, len).unwrap();
                    assert!(day_start(d, off, len).unwrap() <= t && t < day_end(d, off, len).unwrap());
                }
            }
        }
        assert!(day_index_at(0, 0, 0).is_err());
    }

    #[test]
    fn cutoff_and_ceiling() {
        assert_eq!(max_commit_cutoff(86_400), 82_800);
        assert_eq!(max_commit_cutoff(600), 575);
        assert_eq!(max_commit_cutoff(300), 288);
        assert_eq!(stake_ceiling(6).unwrap(), 1_000_000_000_000); // 1M SKR
        assert_eq!(stake_ceiling(0).unwrap(), 1_000_000);
        assert_eq!(stake_ceiling(9).unwrap(), 1_000_000_000_000_000);
        assert!(stake_ceiling(10).is_err());
    }

    #[test]
    fn streak_weight_caps() {
        let s = 100_000_000; // 100 SKR @ 6dp
        assert_eq!(weight_for(s, s, 1, 500, 5_000).unwrap(), s);
        assert_eq!(weight_for(s, s, 3, 500, 5_000).unwrap(), 110_000_000);
        assert_eq!(weight_for(s, s, 60, 500, 5_000).unwrap(), 150_000_000);
        assert_eq!(weight_for(s, s, 0, 500, 5_000).unwrap(), s);
        // variable amounts: floor, never below the amount itself
        assert_eq!(weight_for(1, 1, 11, 500, 5_000).unwrap(), 1); // floor(1.5)
        assert_eq!(weight_for(3, 3, 2, 500, 5_000).unwrap(), 3); // floor(3.15)
        assert_eq!(weight_for(1_000_000_000_000, u64::MAX, 11, 500, 5_000).unwrap(), 1_500_000_000_000);
        assert_eq!(weight_for(u64::MAX / 2, u64::MAX, 100, 10_000, 10_000).unwrap(), u64::MAX - 1);
        assert!(weight_for(u64::MAX, u64::MAX, 2, 10_000, 10_000).is_err()); // 2x overflows u64
        // the boost only covers min(amount, basis): a 1 SKR streak cannot boost a 10,000 SKR stake
        assert_eq!(weight_for(10_000_000_000, 1_000_000, 11, 500, 5_000).unwrap(), 10_000_500_000);
        assert_eq!(weight_for(10_000_000_000, 0, 11, 500, 5_000).unwrap(), 10_000_000_000);
        assert_eq!(weight_for(100, 40, 3, 500, 5_000).unwrap(), 104); // 100 + floor(40 * 0.10)
        // basis >= amount is identical to the plain formula floor(amount * (1 + boost))
        for amount in [1u64, 3, 7, 999_999, 123_456_789] {
            for streak in [1u16, 2, 5, 40] {
                assert_eq!(
                    weight_for(amount, amount, streak, 500, 5_000).unwrap(),
                    weight_for(amount, u64::MAX, streak, 500, 5_000).unwrap()
                );
            }
        }
    }

    #[test]
    fn finalize_nobody_completed_goes_to_reserve() {
        let f = finalize_math(300, 0, 0, 0, 1_000, 50, 1_000).unwrap();
        assert_eq!(f, Finalization { slashed: 300, fee: 30, sponsor: 0, distributable: 0, to_reserve: 270 });
    }

    #[test]
    fn finalize_sponsor_capped_by_reserve() {
        let f = finalize_math(300, 100, 0, 1, 0, 500, 40).unwrap();
        assert_eq!(f.sponsor, 40);
        assert_eq!(f.distributable, 240);
        let f = finalize_math(300, 100, 0, 1, 0, 25, 40).unwrap();
        assert_eq!((f.sponsor, f.distributable), (25, 225)); // capped by the day's sponsor_cap
    }

    #[test]
    fn finalize_everyone_completed() {
        let f = finalize_math(777, 777, 0, 3, 500, 0, 0).unwrap();
        assert_eq!(f, Finalization { slashed: 0, fee: 0, sponsor: 0, distributable: 0, to_reserve: 0 });
        assert!(finalize_math(1, 2, 0, 1, 500, 0, 0).is_err()); // completed > total: impossible, rejected
        assert!(finalize_math(10, 6, 5, 1, 500, 0, 0).is_err()); // completed + revoked > total
    }

    #[test]
    fn revoked_stake_is_never_forfeited() {
        // 300 staked: 100 completed, 150 revoked (refunded), 50 missed -> only 50 is slashed.
        let f = finalize_math(300, 100, 150, 1, 1_000, 0, 0).unwrap();
        assert_eq!(f, Finalization { slashed: 50, fee: 5, sponsor: 0, distributable: 45, to_reserve: 0 });
        // everyone completed but one was revoked: nothing slashed, no fee
        let f = finalize_math(300, 200, 100, 2, 2_000, 0, 0).unwrap();
        assert_eq!((f.slashed, f.fee, f.distributable), (0, 0, 0));
        // all revoked, nobody completed: nothing to the reserve or treasury
        let f = finalize_math(300, 0, 300, 0, 2_000, 0, 0).unwrap();
        assert_eq!(f, Finalization { slashed: 0, fee: 0, sponsor: 0, distributable: 0, to_reserve: 0 });
    }

    #[test]
    fn shares_never_exceed_pool() {
        // 7 completers with awkward weights; distributable not divisible.
        let weights = [100_000_000u64, 105_000_000, 150_000_000, 100_000_000, 123_456_789, 100_000_001, 99_999_999];
        let total: u64 = weights.iter().sum();
        for distributable in [0u64, 1, 6, 7, 999_999_999, 700_000_000_000, u64::MAX / 4] {
            let paid: u128 = weights
                .iter()
                .map(|w| bonus_share(distributable, *w, total).unwrap() as u128)
                .sum();
            assert!(paid <= distributable as u128);
            assert!(distributable as u128 - paid < weights.len() as u128); // dust < n
        }
    }

    #[test]
    fn full_day_conserves_tokens() {
        // 10 users x 100 SKR; 3 complete (one with streak boost); fee 5%.
        let stake = 100_000_000u64;
        let total_staked = 10 * stake;
        let w = [stake, stake, weight_for(stake, stake, 5, 500, 5_000).unwrap()];
        let completed_stake = 3 * stake;
        let f = finalize_math(total_staked, completed_stake, 0, 3, 500, 0, 0).unwrap();
        let total_w: u64 = w.iter().sum();
        let payouts: u64 = w.iter().map(|wi| stake + bonus_share(f.distributable, *wi, total_w).unwrap()).sum();
        let dust = f.distributable - (payouts - completed_stake);
        assert_eq!(payouts + f.fee + dust + f.to_reserve, total_staked);
    }

    /// Mixed stakes, worked by hand (6 decimals, 1 SKR = 1_000_000):
    ///   A 50 SKR completes (streak 1, weight 50e6)
    ///   B 250 SKR completes (streak 3 @ 500 bps: weight 250e6 * 1.10 = 275e6)
    ///   C 1_000 SKR misses, D 7.000003 SKR misses
    /// total 1_307.000003, completed 300, slashed 1_007.000003 SKR = 1_007_000_003
    /// fee 5% = floor(50_350_000.15) = 50_350_000; distributable = 956_650_003
    /// W = 325e6; A: floor(956_650_003 * 50/325) = floor(147_176_923.5) = 147_176_923
    ///            B: floor(956_650_003 * 275/325) = floor(809_473_079.4) = 809_473_079
    /// paid bonus 956_650_002, dust 1.
    #[test]
    fn mixed_stakes_by_hand() {
        let (a, b, c, d) = (50_000_000u64, 250_000_000u64, 1_000_000_000u64, 7_000_003u64);
        let wa = weight_for(a, 0, 1, 500, 5_000).unwrap();
        let wb = weight_for(b, b, 3, 500, 5_000).unwrap();
        assert_eq!((wa, wb), (50_000_000, 275_000_000));
        let f = finalize_math(a + b + c + d, a + b, 0, 2, 500, 0, 0).unwrap();
        assert_eq!(f.slashed, 1_007_000_003);
        assert_eq!(f.fee, 50_350_000);
        assert_eq!(f.distributable, 956_650_003);
        let ba = bonus_share(f.distributable, wa, wa + wb).unwrap();
        let bb = bonus_share(f.distributable, wb, wa + wb).unwrap();
        assert_eq!((ba, bb), (147_176_923, 809_473_079));
        assert_eq!(f.distributable - ba - bb, 1);
        assert_eq!(a + ba + b + bb + f.fee + 1, a + b + c + d);
    }
}
