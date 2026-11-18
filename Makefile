# AliveLine — AWS deployment (CloudFormation) and local helpers. `make` lists targets.
SHELL := /bin/bash
.DEFAULT_GOAL := help

# Root .env (git-ignored) holds AWS credentials: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
# (optionally AWS_SESSION_TOKEN) and BUDGET_EMAIL. Only keys defined there are exported.
-include .env
export $(shell sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' .env 2>/dev/null)

PROJECT    ?= aliveline
# us-east-1: CloudFront flat-rate plan and Bedrock cross-region (us.*) models live here.
AWS_REGION := us-east-1
export AWS_REGION
export AWS_DEFAULT_REGION := $(AWS_REGION)
ARCH       ?= arm64
# Lambda only picks up a new image when its URI changes, so dirty builds get a unique tag.
ifndef TAG
TAG := $(shell git describe --always --dirty=-dirty-$$(date +%Y%m%d%H%M%S) 2>/dev/null || date +%Y%m%d%H%M%S)
endif
CLOUDFRONT_PLAN ?= FREE
BUDGET_EMAIL    ?=

ECR_STACK      := $(PROJECT)-backend-ecr
BACKEND_STACK  := $(PROJECT)-backend
FRONTEND_STACK := $(PROJECT)-frontend
FUNCTION       := $(PROJECT)-backend
TAGS           := PROJECT_NAME=$(PROJECT)
LAMBDA_ARCH     = $(if $(filter arm64,$(ARCH)),arm64,x86_64)

# $(call out,<stack>,<OutputKey>) → shell command printing that stack output (use inside $$(...)).
out = aws cloudformation describe-stacks --stack-name $(1) --query "Stacks[0].Outputs[?OutputKey=='$(2)'].OutputValue" --output text 2>/dev/null

.PHONY: help
help: ## Show this help
	@grep -hE '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------- local
.PHONY: test build
test: ## Backend tests
	cd backend && pytest -q
build: ## Build the all-in-one Docker image (infra/Dockerfile)
	docker build -f infra/Dockerfile -t $(PROJECT) .

# ---------------------------------------------------------------- AWS
.PHONY: aws-check aws-deploy aws-ecr aws-push aws-backend aws-migrate aws-frontend aws-publish \
        aws-url aws-health aws-logs aws-destroy

aws-check: ## Verify AWS credentials from .env
	@aws sts get-caller-identity --query '[Account, Arn]' --output text \
	  || { echo "AWS credentials missing/invalid: set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env"; exit 1; }

aws-deploy: aws-check aws-ecr aws-push aws-backend aws-migrate aws-frontend aws-publish ## Deploy everything
	@echo; echo "Site: $$($(call out,$(FRONTEND_STACK),SiteUrl))"

aws-ecr: ## Create/update the ECR repository
	aws cloudformation deploy --stack-name $(ECR_STACK) --template-file infra/backend-ecr.yaml \
	  --parameter-overrides ProjectName=$(PROJECT) --tags $(TAGS) --no-fail-on-empty-changeset

aws-push: ## Build the Lambda image for linux/$(ARCH) and push it as :$(TAG)
	@uri=$$($(call out,$(ECR_STACK),RepositoryUri)); test -n "$$uri" || { echo "Run make aws-ecr first"; exit 1; }; \
	aws ecr get-login-password | docker login --username AWS --password-stdin "$${uri%%/*}" && \
	docker buildx build --platform linux/$(ARCH) --provenance=false -f infra/Dockerfile.lambda \
	  -t "$$uri:$(TAG)" -t "$$uri:latest" --push .

aws-backend: ## Create/update VPC + Aurora + Lambda with image :$(TAG) (first run ~10 min)
	@uri=$$($(call out,$(ECR_STACK),RepositoryUri)); test -n "$$uri" || { echo "Run make aws-ecr first"; exit 1; }; \
	aws cloudformation deploy --stack-name $(BACKEND_STACK) --template-file infra/backend.yaml \
	  --capabilities CAPABILITY_IAM --tags $(TAGS) --no-fail-on-empty-changeset \
	  --parameter-overrides ProjectName=$(PROJECT) ImageUri=$$uri:$(TAG) Architecture=$(LAMBDA_ARCH) \
	    BudgetAlertEmail=$(BUDGET_EMAIL)

aws-migrate: ## Create tables inside the Lambda (wakes Aurora if paused)
	@resp=$$(mktemp); \
	err=$$(aws lambda invoke --function-name $(FUNCTION) --cli-binary-format raw-in-base64-out \
	  --payload '{"action": "migrate"}' --cli-read-timeout 0 --query FunctionError --output text "$$resp"); \
	echo "Migrate: $$(cat $$resp)"; rm -f "$$resp"; \
	[ "$$err" = None ] || { echo "Migration failed ($$err): make aws-logs"; exit 1; }

aws-frontend: ## Create/update S3 + CloudFront (routes /api/* to the Lambda)
	@api=$$($(call out,$(BACKEND_STACK),ApiDomain)); test -n "$$api" || { echo "Run make aws-backend first"; exit 1; }; \
	aws cloudformation deploy --stack-name $(FRONTEND_STACK) --template-file infra/frontend.yaml \
	  --tags $(TAGS) --no-fail-on-empty-changeset \
	  --parameter-overrides ProjectName=$(PROJECT) ApiDomain=$$api PricingPlan=$(CLOUDFRONT_PLAN)

aws-publish: ## Build the SPA, upload it to S3, invalidate CloudFront
	@bucket=$$($(call out,$(FRONTEND_STACK),BucketName)); dist=$$($(call out,$(FRONTEND_STACK),DistributionId)); \
	test -n "$$bucket" || { echo "Run make aws-frontend first"; exit 1; }; \
	(cd frontend && npm ci --no-audit --no-fund && npm run build) && \
	aws s3 sync frontend/dist "s3://$$bucket" --delete --exclude index.html \
	  --cache-control "public,max-age=31536000,immutable" && \
	aws s3 cp frontend/dist/index.html "s3://$$bucket/index.html" --cache-control "no-cache" && \
	aws cloudfront create-invalidation --distribution-id "$$dist" --paths "/*" --query Invalidation.Id --output text

aws-url: ## Print the site URL
	@echo "$$($(call out,$(FRONTEND_STACK),SiteUrl))"

aws-health: ## Call /api/health through CloudFront (first call after a pause wakes Aurora, ~15 s)
	@curl -fsS "$$($(call out,$(FRONTEND_STACK),SiteUrl))/api/health"; echo

aws-logs: ## Tail backend logs
	aws logs tail /aws/lambda/$(FUNCTION) --since 30m --follow

aws-destroy: aws-check ## Delete all stacks (Aurora keeps a final snapshot)
	@read -p "Delete ALL $(PROJECT) stacks and data? Type '$(PROJECT)': " ans; [ "$$ans" = "$(PROJECT)" ] || exit 1; \
	bucket=$$($(call out,$(FRONTEND_STACK),BucketName)); [ -z "$$bucket" ] || aws s3 rm "s3://$$bucket" --recursive; \
	for s in $(FRONTEND_STACK) $(BACKEND_STACK) $(ECR_STACK); do \
	  aws cloudformation delete-stack --stack-name $$s && aws cloudformation wait stack-delete-complete --stack-name $$s; done
