package main

import (
	"math/rand"
	"net/http"
	"os"
	"strconv"

	"github.com/labstack/echo/v4"
)

var (
	HealthRate = 1.0
	Version    = "unknown"
)

func init() {
	if r, ok := os.LookupEnv("HEALTH_RATE"); ok {
		if f, err := strconv.ParseFloat(r, 64); err == nil {
			HealthRate = f
		}
	}

	if r, ok := os.LookupEnv("VERSION"); ok {
		Version = r
	}
}

func main() {
	e := echo.New()
	e.GET("/", func(c echo.Context) error {
		code := http.StatusOK
		if HealthRate < rand.Float64() {
			code = http.StatusServiceUnavailable
		}
		return c.JSON(code, map[string]string{
			"message": "Hello, World!",
			"version": Version,
		})
	})
	// endpoint for healthcheck
	e.GET("health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"status": "pass",
		})
	})

	e.Logger.Fatal(e.Start(":1323"))
}
