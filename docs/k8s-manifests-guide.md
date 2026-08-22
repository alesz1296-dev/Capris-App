# Kubernetes manifests guide

These Kubernetes manifests are stored as flat files in `docs/` because the current workspace policy did not allow creating a new top-level manifests directory during this Phase 2 pass.

Files:

- [k8s-kustomization.yaml](/C:/Users/alesz/Projects_Apps/Capris-App/docs/k8s-kustomization.yaml)
- [k8s-namespace.yaml](/C:/Users/alesz/Projects_Apps/Capris-App/docs/k8s-namespace.yaml)
- [k8s-configmap.yaml](/C:/Users/alesz/Projects_Apps/Capris-App/docs/k8s-configmap.yaml)
- [k8s-secret.example.yaml](/C:/Users/alesz/Projects_Apps/Capris-App/docs/k8s-secret.example.yaml)
- [k8s-api-deployment.yaml](/C:/Users/alesz/Projects_Apps/Capris-App/docs/k8s-api-deployment.yaml)
- [k8s-api-service.yaml](/C:/Users/alesz/Projects_Apps/Capris-App/docs/k8s-api-service.yaml)
- [k8s-web-deployment.yaml](/C:/Users/alesz/Projects_Apps/Capris-App/docs/k8s-web-deployment.yaml)
- [k8s-web-service.yaml](/C:/Users/alesz/Projects_Apps/Capris-App/docs/k8s-web-service.yaml)
- [k8s-ingress.yaml](/C:/Users/alesz/Projects_Apps/Capris-App/docs/k8s-ingress.yaml)

Assumptions:

- PostgreSQL is external or managed
- API and web images are already built and published
- Prometheus scrapes the API, not the web app
- secrets are replaced before cluster apply

Apply example:

```bash
kubectl apply -f docs/k8s-namespace.yaml
kubectl apply -f docs/k8s-configmap.yaml
kubectl apply -f docs/k8s-secret.example.yaml
kubectl apply -f docs/k8s-api-deployment.yaml
kubectl apply -f docs/k8s-api-service.yaml
kubectl apply -f docs/k8s-web-deployment.yaml
kubectl apply -f docs/k8s-web-service.yaml
kubectl apply -f docs/k8s-ingress.yaml
```

Replace before use:

- image references
- hostnames
- secret values
- ingress class if not using nginx
