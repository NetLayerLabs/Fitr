use crate::constants::SGT_GROUP;
use crate::error::VaultError;
use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::{
    self,
    extension::{
        metadata_pointer::MetadataPointer, BaseStateWithExtensions, ExtensionType,
        StateWithExtensions,
    },
};
use anchor_spl::token_2022::spl_token_2022::extension::group_member_pointer::GroupMemberPointer;
// spl-token-2022 v6 does not re-export this type; depend on the same version anchor-spl 0.31 uses.
use spl_token_group_interface::state::TokenGroupMember;

/// Staked mint must be classic SPL Token, or Token-2022 with only "inert" extensions.
/// Allow-list (not deny-list) so future extensions (pausable, scaled UI, ...) are rejected by default.
pub fn assert_supported_stake_mint(mint_info: &AccountInfo) -> Result<()> {
    if *mint_info.owner != spl_token_2022::ID {
        return Ok(()); // classic SPL Token: no extensions possible
    }
    let data = mint_info.try_borrow_data()?;
    let mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&data)?;
    for ext in mint.get_extension_types()? {
        let ok = matches!(
            ext,
            ExtensionType::MetadataPointer
                | ExtensionType::TokenMetadata
                | ExtensionType::GroupPointer
                | ExtensionType::TokenGroup
                | ExtensionType::GroupMemberPointer
                | ExtensionType::TokenGroupMember
                | ExtensionType::MintCloseAuthority
        );
        require!(ok, VaultError::UnsupportedMintExtension);
    }
    Ok(())
}

/// A mint is a Seeker Genesis Token iff it is a Token-2022 mint whose
/// TokenGroupMember.group == SGT_GROUP and MetadataPointer.metadata_address == SGT_GROUP.
/// The group-member check is the load-bearing one: Token-2022's InitializeMember
/// requires the group update authority to sign, so nobody else can mint a member.
pub fn assert_is_sgt(mint_info: &AccountInfo) -> Result<()> {
    require_keys_eq!(*mint_info.owner, spl_token_2022::ID, VaultError::InvalidSgt);
    let data = mint_info.try_borrow_data()?;
    let mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&data)
        .map_err(|_| error!(VaultError::InvalidSgt))?;
    let member = mint
        .get_extension::<TokenGroupMember>()
        .map_err(|_| error!(VaultError::InvalidSgt))?;
    require_keys_eq!(member.group, SGT_GROUP, VaultError::InvalidSgt);
    require_keys_eq!(member.mint, mint_info.key(), VaultError::InvalidSgt);
    let mp = mint
        .get_extension::<MetadataPointer>()
        .map_err(|_| error!(VaultError::InvalidSgt))?;
    let md: Option<Pubkey> = mp.metadata_address.into();
    require!(md == Some(SGT_GROUP), VaultError::InvalidSgt);
    // GroupMemberPointer must exist for a member (Token-2022 enforces it); read for defence in depth.
    mint.get_extension::<GroupMemberPointer>()
        .map_err(|_| error!(VaultError::InvalidSgt))?;
    Ok(())
}
