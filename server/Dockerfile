# Build from repository root:
#   docker build -f server/Dockerfile -t hello-gutsyang-api .
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/server ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build /out/server /app/server
COPY config /config
ENV APP_CONFIG=/config/app.yaml
EXPOSE 8080
VOLUME ["/app/uploads"]
ENTRYPOINT ["/app/server"]
