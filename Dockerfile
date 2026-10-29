FROM golang:1.25-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY cmd/ ./cmd/
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/snippetbox ./cmd/main

FROM alpine:3.22

WORKDIR /app

COPY --from=build /out/snippetbox ./snippetbox

EXPOSE 1223

ENTRYPOINT ["./snippetbox", "-addr", ":1223"]
