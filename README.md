![CI](https://github.com/Ogheneyomanice/yuma-skincare-shop/actions/workflows/ci.yml/badge.svg)
# Yuma Skincare e-commerce shop

A small online skincare shop (Node.js + Express) built to show a complete DevOps workflow:
tests, a Docker image, a CI/CD pipeline on GitHub Actions, infrastructure as code with Terraform,
and automatic deployment to AWS (ECS Fargate behind a load balancer).

> Demo project. Orders are kept in memory and no real payments are taken.

## What it does

- Storefront with 8 products, a cart saved in the browser, and a checkout form.
- `GET /api/products`, `POST /api/orders` (the server calculates the total, never the browser), `GET /health`.
- 12 automated tests (`npm test`).

## DevOps pieces

| Piece | File | What it shows |
|---|---|---|
| Container | `Dockerfile` | Multi-stage build, non-root user, `HEALTHCHECK`, small Alpine image |
| CI | `.github/workflows/ci.yml` | Tests on Node 20 and 22, ShellCheck, Hadolint, `npm audit`, image build, container smoke test, push to GHCR |
| CD | `.github/workflows/deploy.yml` | Build, push to ECR, deploy to ECS, wait for stability, post-deploy health check. AWS login with OIDC (no stored keys) |
| Infrastructure | `terraform/` | VPC across 2 AZs, ALB, ECR, ECS Fargate, autoscaling, CloudWatch logs and alarm, deploy role |
| Health script | `scripts/check_health.sh` | Retrying health check used by CI and after every deploy |

Pipeline flow:

```
pull request  ->  test + lint + audit
push to main  ->  test + lint + audit -> build image -> smoke test -> push to GHCR
                  -> (if AWS is configured) build -> push to ECR -> deploy to ECS -> health check
```

If a new release fails its health checks, the ECS deployment circuit breaker rolls it back automatically.

## Run it on your computer

Needs Node.js 20 or newer.

```bash
npm install
npm test
npm start            # open http://localhost:3000
```

In another terminal, check it is healthy:

```bash
bash scripts/check_health.sh http://localhost:3000
```

With Docker Desktop:

```bash
docker compose up --build     # open http://localhost:3000
```

## Put it on GitHub (CI only, no AWS needed)

1. Create an empty repository called `yuma-skincare-shop` on GitHub.
2. In this folder run:
   ```bash
   git init
   git add .
   git commit -m "Yuma Skincare shop with CI/CD"
   git branch -M main
   git remote add origin https://github.com/<your-username>/yuma-skincare-shop.git
   git push -u origin main
   ```
3. Open the **Actions** tab. The CI workflow runs; when it is green, your image is in
   **Packages** (GHCR) on your repository page.
4. Add the green badge to the top of this README:
   `![CI](https://github.com/<your-username>/yuma-skincare-shop/actions/workflows/ci.yml/badge.svg)`

## Deploy to AWS (optional)

This creates real AWS resources that cost money (the load balancer is the main cost, roughly a few
US dollars per day with 2 tasks). Destroy everything when you finish recording screenshots.

Needs: an AWS account, AWS CLI configured (`aws configure`), Terraform 1.5 or newer, Docker.

1. Create the registry first and push a first image:
   ```bash
   cd terraform
   terraform init
   terraform apply -target=aws_ecr_repository.app -var="github_repository=<your-username>/yuma-skincare-shop"
   cd ..
   aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.eu-west-1.amazonaws.com
   docker build -t <account-id>.dkr.ecr.eu-west-1.amazonaws.com/yuma-shop:latest .
   docker push <account-id>.dkr.ecr.eu-west-1.amazonaws.com/yuma-shop:latest
   ```
   (`terraform output ecr_repository_url` shows the exact registry address.)
2. Create everything else:
   ```bash
   cd terraform
   terraform apply -var="github_repository=<your-username>/yuma-skincare-shop"
   ```
   If your AWS account already has a GitHub OIDC provider, add `-var="create_github_oidc_provider=false"`.
3. Copy the values from `terraform output github_variables` into GitHub:
   **Settings -> Secrets and variables -> Actions -> Variables**
   (`AWS_REGION`, `AWS_ROLE_ARN`, `ECR_REPOSITORY`, `ECS_CLUSTER`, `ECS_SERVICE`, `ECS_TASK_FAMILY`, `APP_URL`).
4. Create an environment called `production` (**Settings -> Environments**). Optionally add yourself
   as a required reviewer to show a manual approval gate.
5. Push any change to `main`. CI runs, then Deploy ships it to ECS. Open `APP_URL` to see the shop.
6. Clean up when done:
   ```bash
   cd terraform && terraform destroy -var="github_repository=<your-username>/yuma-skincare-shop"
   ```

## Design decisions (good interview talking points)

- **Prices are checked on the server.** The browser only sends product ids and quantities.
- **Same health endpoint everywhere.** The Docker `HEALTHCHECK`, the ALB target group, the CI smoke test
  and `check_health.sh` all use `/health`.
- **No long-lived AWS keys.** GitHub Actions assumes an IAM role through OIDC, limited to this repository.
- **Terraform and the pipeline do not fight.** The task definition ignores image changes in Terraform
  because the pipeline owns releases.
- **Cost-conscious.** Public subnets without a NAT gateway; tasks only accept traffic from the load balancer.

## Known limits and next steps

- Orders live in memory. Next step: a database such as Amazon RDS or DynamoDB.
- HTTP only. Next step: a domain, an ACM certificate and an HTTPS listener (redirect port 80 to 443).
- Terraform state is local. Next step: an S3 backend with locking.
- No staging environment yet. Next step: a second Terraform workspace and a promotion step.
