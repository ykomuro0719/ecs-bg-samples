FROM public.ecr.aws/docker/library/golang:1.22 AS builder

ARG VERSION=${VERSION:-unknown}
ENV VERSION ${VERSION}

WORKDIR /app
COPY . /app
RUN go build -o bin/main

CMD ["./bin/main"]
