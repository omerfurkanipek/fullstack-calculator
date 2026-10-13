.DEFAULT_GOAL := help
.PHONY: help install run-backend run-frontend test test-backend test-frontend coverage lint docker-build docker-run

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install frontend dependencies
	cd frontend && npm ci

run-backend: ## Run the Go API on :8080
	cd backend && go run ./cmd/server

run-frontend: ## Run the Vite dev server on :5173 (proxies /api to :8080)
	cd frontend && npm run dev

test: test-backend test-frontend ## Run all unit tests

test-backend: ## Run Go tests with the race detector
	cd backend && go test -race ./...

test-frontend: ## Run Vitest
	cd frontend && npm test

coverage: ## Generate coverage reports for both layers into docs/coverage
	mkdir -p docs/coverage
	cd backend && go test -coverprofile=coverage.out ./... && go tool cover -func=coverage.out | tee ../docs/coverage/backend.txt && go tool cover -html=coverage.out -o coverage.html
	cd frontend && npx vitest run --coverage --coverage.reporter=text | sed -e 's/\x1b\[[0-9;]*m//g' | sed -n '/Coverage report/,$$p' | tee ../docs/coverage/frontend.txt

lint: ## Static checks for both layers
	cd backend && gofmt -l . | (! grep .) && go vet ./...
	cd frontend && npm run lint && npm run typecheck

docker-build: ## Build the full-stack image
	docker build -t fullstack-calculator .

docker-run: docker-build ## Run the full-stack image on http://localhost:8080
	docker run --rm -p 8080:8080 fullstack-calculator
