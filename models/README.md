# Model Artifacts

Phase 6 writes two model artifacts:

- `ecosystem-risk-model.joblib`: selected trusted-local `VersionedPredictor`, ignored by Git because model binaries should live in an artifact registry outside this demo;
- `ml-training-summary.json`: committed compact evidence containing the dataset ID, feature schema, split counts, selection rule, validation/test metrics, selected version, hybrid-risk summary, and binary SHA-256.

Only load a Joblib file produced by a trusted JaalDrishti training run. Joblib is a Python object format and is not safe for untrusted uploads.

Recreate both artifacts from the repository root:

```bash
.venv/bin/jaal-train-ml --output-dir models --replace
```

The model adapter rejects matrices that do not match the persisted feature count. Production promotion should additionally validate exact ordered feature names and schema version at the feature-service boundary, store the binary in a signed model registry, and require approval/rollback metadata.
