.PHONY: run test vet fmt migrate status

run:
	go run ./cmd/server

test:
	go test ./...

vet:
	go vet ./...

fmt:
	gofmt -w .

migrate:
	go run ./cmd/server migrate up

status:
	go run ./cmd/server migrate status
