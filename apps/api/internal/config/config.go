package config

import (
	"fmt"
	"net"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Env, HTTPAddr, DatabaseURL, AppBaseURL                      string
	OIDCIssuer, OIDCClientID, OIDCClientSecret, OIDCRedirectURL string
	SessionTTL                                                  time.Duration
	CookieSecure                                                bool
	TextMaxLength                                               int
	OpenAIModel                                                 string
}

func Load(envFile string) (Config, error) {
	if err := godotenv.Load(envFile); err != nil && !os.IsNotExist(err) {
		return Config{}, fmt.Errorf("cannot read environment file")
	}
	return Parse(os.Getenv)
}

func Parse(get func(string) string) (Config, error) {
	c := Config{Env: get("APP_ENV"), HTTPAddr: get("HTTP_ADDR"), DatabaseURL: get("DATABASE_URL"), AppBaseURL: get("APP_BASE_URL"), OIDCIssuer: get("OIDC_ISSUER_URL"), OIDCClientID: get("OIDC_CLIENT_ID"), OIDCClientSecret: get("OIDC_CLIENT_SECRET"), OIDCRedirectURL: get("OIDC_REDIRECT_URL"), OpenAIModel: get("OPENAI_MODEL")}
	if c.Env != "development" && c.Env != "test" && c.Env != "production" {
		return c, fmt.Errorf("APP_ENV must be development, test, or production")
	}
	if _, _, err := net.SplitHostPort(c.HTTPAddr); err != nil {
		return c, fmt.Errorf("HTTP_ADDR must be a host:port address")
	}
	dsn, err := url.Parse(c.DatabaseURL)
	if err != nil || dsn == nil || (dsn.Scheme != "postgres" && dsn.Scheme != "postgresql") || dsn.Hostname() == "" || dsn.Path == "" {
		return c, fmt.Errorf("DATABASE_URL must be a PostgreSQL URL")
	}
	if c.Env == "production" && dsn.Query().Get("sslmode") != "verify-full" {
		return c, fmt.Errorf("DATABASE_URL requires sslmode=verify-full in production")
	}
	for _, item := range []struct{ name, value string }{{"APP_BASE_URL", c.AppBaseURL}, {"OIDC_ISSUER_URL", c.OIDCIssuer}, {"OIDC_REDIRECT_URL", c.OIDCRedirectURL}} {
		u, err := url.Parse(item.value)
		if err != nil || u.Hostname() == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil || u.Fragment != "" || u.RawQuery != "" {
			return c, fmt.Errorf("%s must be an HTTP URL without credentials, query, or fragment", item.name)
		}
		if c.Env == "production" && u.Scheme != "https" {
			return c, fmt.Errorf("%s requires HTTPS in production", item.name)
		}
		if item.name == "APP_BASE_URL" && u.Path != "" && u.Path != "/" {
			return c, fmt.Errorf("APP_BASE_URL must be an origin URL")
		}
	}
	base, _ := url.Parse(c.AppBaseURL)
	callback, _ := url.Parse(c.OIDCRedirectURL)
	if base.Scheme != callback.Scheme || base.Host != callback.Host || callback.Path != "/api/auth/callback" {
		return c, fmt.Errorf("OIDC_REDIRECT_URL must use APP_BASE_URL with /api/auth/callback")
	}
	c.AppBaseURL = base.Scheme + "://" + base.Host
	if c.OIDCClientID == "" {
		return c, fmt.Errorf("OIDC_CLIENT_ID is required")
	}
	if c.OpenAIModel == "" {
		return c, fmt.Errorf("OPENAI_MODEL is required to queue analysis jobs")
	}
	secure, err := strconv.ParseBool(get("SESSION_COOKIE_SECURE"))
	if err != nil {
		return c, fmt.Errorf("SESSION_COOKIE_SECURE must be a boolean")
	}
	if c.Env == "production" && !secure {
		return c, fmt.Errorf("SESSION_COOKIE_SECURE must be true in production")
	}
	c.CookieSecure = secure
	ttl, err := strconv.Atoi(get("SESSION_TTL_SECONDS"))
	if err != nil || ttl <= 0 || ttl > 2592000 {
		return c, fmt.Errorf("SESSION_TTL_SECONDS must be between 1 and 2592000")
	}
	c.SessionTTL = time.Duration(ttl) * time.Second
	c.TextMaxLength, err = strconv.Atoi(get("TEXT_MAX_LENGTH"))
	if err != nil || c.TextMaxLength <= 0 || c.TextMaxLength > 100000 {
		return c, fmt.Errorf("TEXT_MAX_LENGTH must be between 1 and 100000")
	}
	return c, nil
}
