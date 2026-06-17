#![cfg_attr(not(test), no_std)]
#![cfg_attr(not(test), no_main)]
//! AegisRegistry — an on-chain attestation and reputation registry for the
//! Aegis402 risk oracle.
//!
//! An assessor (the oracle, or any agent) records a risk verdict for an asset by
//! posting a hash of the assessment. The contract keeps the latest hash per
//! asset and a per-assessor reputation counter, giving the oracle a verifiable
//! on-chain identity that grows with its track record. Contract metadata follows
//! CEP-96 so wallets and explorers show an authentic self-declared identity.
extern crate alloc;

use odra::prelude::*;
use odra_modules::cep96::{Cep96, Cep96ContractMetadata};

/// Emitted on every attestation.
#[odra::event]
pub struct Attested {
    /// The account that posted the attestation.
    pub assessor: Address,
    /// The asset identifier (CEP-18 package hash hex, or any asset id).
    pub asset: String,
    /// The assessor's reputation count after this attestation.
    pub reputation: u64,
}

#[odra::module]
pub struct AegisRegistry {
    metadata: SubModule<Cep96>,
    reputation: Mapping<Address, u64>,
    latest: Mapping<String, String>,
    total: Var<u64>,
}

#[odra::module]
impl AegisRegistry {
    /// Initialize with CEP-96 contract metadata (name, description, icon, project).
    pub fn init(
        &mut self,
        contract_name: Option<String>,
        contract_description: Option<String>,
        contract_icon_uri: Option<String>,
        contract_project_uri: Option<String>,
    ) {
        self.metadata.init(
            contract_name,
            contract_description,
            contract_icon_uri,
            contract_project_uri,
        );
        self.total.set(0);
    }

    /// Record a risk verdict: store the verdict hash (hex) for `asset` and bump
    /// the caller's reputation. Returns the caller's new reputation count.
    pub fn attest(&mut self, asset: String, verdict_hash: String) -> u64 {
        let caller = self.env().caller();
        let rep = self.reputation.get_or_default(&caller) + 1;
        self.reputation.set(&caller, rep);
        self.latest.set(&asset, verdict_hash);
        self.total.set(self.total.get_or_default() + 1);
        self.env().emit_event(Attested {
            assessor: caller,
            asset,
            reputation: rep,
        });
        rep
    }

    /// Reputation (number of attestations) for an assessor.
    pub fn reputation_of(&self, assessor: Address) -> u64 {
        self.reputation.get_or_default(&assessor)
    }

    /// The latest verdict hash (hex) posted for an asset, if any.
    pub fn latest_of(&self, asset: String) -> Option<String> {
        self.latest.get(&asset)
    }

    /// Total attestations recorded across all assessors.
    pub fn total_attestations(&self) -> u64 {
        self.total.get_or_default()
    }

    // CEP-96 metadata getters.
    delegate! {
        to self.metadata {
            fn contract_name(&self) -> Option<String>;
            fn contract_description(&self) -> Option<String>;
            fn contract_icon_uri(&self) -> Option<String>;
            fn contract_project_uri(&self) -> Option<String>;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use odra::host::{Deployer, HostRef};

    fn setup() -> AegisRegistryHostRef {
        let env = odra_test::env();
        AegisRegistry::deploy(
            &env,
            AegisRegistryInitArgs {
                contract_name: Some("Aegis402 Registry".to_string()),
                contract_description: Some(
                    "On-chain attestation + reputation for the Aegis402 risk oracle".to_string(),
                ),
                contract_icon_uri: None,
                contract_project_uri: Some("https://github.com/codebycinar/aegis402".to_string()),
            },
        )
    }

    #[test]
    fn attest_increments_reputation_and_total() {
        let mut c = setup();
        let h = "ab".repeat(32);
        assert_eq!(c.attest("assetA".to_string(), h.clone()), 1);
        assert_eq!(c.attest("assetB".to_string(), h.clone()), 2);
        assert_eq!(c.total_attestations(), 2);
        assert_eq!(c.latest_of("assetA".to_string()), Some(h));
    }

    #[test]
    fn metadata_is_set() {
        let c = setup();
        assert_eq!(c.contract_name(), Some("Aegis402 Registry".to_string()));
    }
}
