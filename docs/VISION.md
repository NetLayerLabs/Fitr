# Fitr: vision, business model and roadmap

Fitr turns "I'll work out tomorrow" into a promise with something on it. This page is about where
Fitr goes after the hackathon: who it is for, how it makes money, why it belongs on Solana Mobile,
and the concrete next steps. Everything marked **Live** runs on Solana mainnet today; everything
else is a plan, stated as one.

## The opportunity

- **The problem is universal.** People pay for fitness and do not show up: gym members on flat
  monthly plans averaged 4.3 visits a month, paying over $17 a visit when a $10 pass was on offer
  (DellaVigna & Malmendier, *American Economic Review*, 2006). Motivation fades; commitments hold.
- **Money on the line already works.** Commitment contracts help people keep promises they keep
  breaking (Giné, Karlan & Zinman, 2010), and consumer businesses have been built on the idea
  (stickK, Beeminder, DietBet / WayBetter). What they lack is proof: they trust self-reported
  workouts or a photo of a scale.
- **Fitr adds the proof.** On-device AI counts every rep against a joint-angle standard, random
  live challenges stop pre-recorded clips, and the result settles onchain by rules nobody can bend.
  Video never leaves the phone, so it works on modest data plans.

## Why Fitr belongs on Solana Mobile

Fitr is built for the Seeker, not ported to it:

| Seeker / Solana Mobile piece | How Fitr uses it | Why it matters to Solana Mobile |
| --- | --- | --- |
| **Seeker Genesis Token** | One Seeker, one stake: the vault checks a real SGT and a per-device lock | A reason to own a Seeker: commitments are Seeker-only |
| **Seed Vault + Mobile Wallet Adapter** | Every stake and claim is signed in the phone's secure hardware | Shows Seed Vault in a daily, non-trading habit |
| **SKR** | Stakes, forfeits, the sponsor reserve and the 5% fee are all in SKR | Real, recurring utility for SKR (locked daily, recycled to finishers) |
| **dApp Store / native Android** | A real Android app with camera, voice coach, reminders, widget, shortcuts and App Links | A daily-active app on the Seeker home screen |
| **Blinks / Solana Actions** | "Commit with me" and "Sponsor a day" work from any wallet or social post | Brings people from X and chats straight into Seeker flows |

**The flywheel.** Each day people lock SKR on their own goal → the ones who show up take back
their stake plus what no-shows forfeited → sponsors (brands, gyms, the community) add SKR to the
reserve as a bonus for showing up → more people commit, and more of them want a Seeker to do it.
Fitr is a habit people open every day, which is exactly what a phone ecosystem needs.

## Who it is for

1. **Seeker owners (now).** Crypto-native users who want accountability with real stakes. **Live.**
2. **Gyms and their members (next).** Gyms lose members when motivation fades. Fitr gives them
   challenges, crew leaderboards, AI-verified home workouts on non-gym days, and a view of who is
   slipping. The founders have direct relationships with gym owners in Nigeria; a pilot is the
   first step after the hackathon.
3. **Everyday users (later).** People who have never held crypto: phone or email sign-in,
   Play Store listing, local payments, prizes funded by sponsors before any user money is at stake.

## Business model

| Revenue stream | How | Notes |
| --- | --- | --- |
| **Gym partnerships (B2B)** | Gyms pay Fitr monthly to run challenges for their members: leaderboards (crews), AI-verified home workouts on non-gym days, and a dashboard of who is slipping | First market: gyms in Nigeria. The gym's real problem is members quitting; Fitr shows who is showing up. |
| **Sponsored challenges** | A brand (sportswear, drinks, a telco) or the gym funds the prize for finishers | Uses the **live** sponsor feature. No user money involved: the lowest regulatory risk. |
| **Subscription ("Fitr Pro")** | Free: rep counting and streaks. Paid: programs, advanced stats, more crews | Priced locally (for example in Naira) |
| **Corporate wellness** | Employers (banks, telcos) sponsor staff challenges | Larger contracts, repeatable |
| **Money commitments** | The 5% fee on forfeited stakes only (nobody who shows up pays it) | **Live** on mainnet in SKR. Fiat versions only after legal review (see Risks). |

## Roadmap

| Phase | When | What | How we will measure it |
| --- | --- | --- | --- |
| **0. Live today** | October 2026 | Mainnet vault (Squads 2-of-3, verifiable build), staking, verification with live challenges, crews, sponsored days, Blinks, 9 languages, Android app | Onchain: stakes, verified days, sponsor reserve (public at fitr.day/pool) |
| **1. dApp Store + Seeker growth** | Weeks 1-4 after the hackathon | Solana dApp Store listing, crew challenges with the Seeker community, sponsored "showing up" weeks in SKR | Weekly active stakers, verification pass rate, day-7 and day-30 retention |
| **2. Gym pilot (Nigeria)** | Weeks 4-12 | 1-2 gyms run a 30-day challenge with a gym-sponsored prize; members use Fitr at home and at the gym | Attendance and retention vs. members not using Fitr; a published case study |
| **3. Everyday users** | Months 3-6 | Phone / email sign-in (wallet optional), Play Store listing, subscription with local payments, stablecoin stakes alongside SKR, performance on low-end Android | Paying subscribers, gym contracts, cost per active user |
| **4. Scale and decentralize** | Months 6-12 | Corporate wellness, more gyms and cities, iOS, more attestors so verification no longer depends on one server | Revenue per gym, number of independent attestors |

## Why this team can do it

In a few weeks of building we shipped, on Solana **mainnet**, a vault holding real money with no
single point of control (Squads 2-of-3 owns the program and the pool; the deployer key was emptied),
a reproducible build anyone can verify, 79 program tests including 256 randomized scenarios, two
internal security review rounds, an AI rep counter for 16 exercises, a verification server with live
challenges, a native Android app, and the app in nine languages. The full list is in the
[README](../README.md).

## What support from Solana Mobile would unlock

- **Distribution:** a dApp Store feature and the Seeker community for the first crew challenges.
- **SKR sponsorship:** a sponsored "showing up" season funded in SKR, which directly grows SKR's
  utility and Fitr's daily actives.
- **Grant / backing:** to run the gym pilots, ship phone sign-in and the Play Store version, and
  add independent attestors.

## Risks, stated plainly

- **Regulation of money pools.** Paying one user's forfeit to other users can be classed as betting
  in some countries (in Nigeria, gaming regulators at national and state level). Mitigation: start
  with sponsor-funded prizes (no user money), offer forfeits-to-charity, and take legal advice in
  each market before any fiat stakes.
- **Trust in verification.** Today Fitr's server is the attestor. Onchain limits already contain it
  (per-day rule snapshots, refund-only revokes, a review window in which the multisig can void a
  day); the plan is more, independent attestors.
- **Cheating.** Cheat-resistant, not cheat-proof: live challenges make faking expensive, not
  impossible. The money at stake per person is bounded by the pool's limits.
- **Device reach.** Staking is Seeker-only by design today; everyday users first get the free AI
  coach and sponsor-funded challenges, which need no Seeker.
