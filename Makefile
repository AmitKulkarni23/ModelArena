.PHONY: build-models build-orchestrator build-frontend build deploy synth clean dev-frontend dev-models dev-orchestrator

build-models:
	cd backend/models && cargo lambda build --release --arm64

build-orchestrator:
	cd backend/orchestrator && cargo lambda build --release --arm64

build-frontend:
	cd frontend && bun install && bun run build

build: build-models build-orchestrator build-frontend

deploy: build
	cd infra && npx cdk deploy --require-approval never

synth:
	cd infra && npx cdk synth

clean:
	cd backend/models && cargo clean
	cd backend/orchestrator && cargo clean
	cd frontend && rm -rf dist node_modules

dev-frontend:
	cd frontend && bun run dev

dev-models:
	cd backend/models && cargo lambda watch

dev-orchestrator:
	cd backend/orchestrator && cargo lambda watch
