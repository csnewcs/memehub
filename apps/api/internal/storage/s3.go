package storage

import (
	"bytes"
	"context"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/noeulnight/memehub/apps/api/internal/config"
)

type Store struct {
	client *s3.Client
	signer *s3.PresignClient
	bucket string
	ttl    time.Duration
}
type SignedURL struct {
	URL       string    `json:"url"`
	ExpiresAt time.Time `json:"expires_at"`
}
type Upload struct {
	URL       string            `json:"url"`
	Method    string            `json:"method"`
	Headers   map[string]string `json:"headers"`
	ExpiresAt time.Time         `json:"expires_at"`
}

func New(c config.Config) *Store {
	if c.S3Endpoint == "" {
		return nil
	}
	cfg := aws.Config{RequestChecksumCalculation: aws.RequestChecksumCalculationWhenRequired, Region: c.S3Region, Credentials: credentials.NewStaticCredentialsProvider(c.S3AccessKey, c.S3SecretKey, "")}
	client := s3.NewFromConfig(cfg, func(o *s3.Options) { o.BaseEndpoint = aws.String(c.S3Endpoint); o.UsePathStyle = c.S3PathStyle })
	public := s3.NewFromConfig(cfg, func(o *s3.Options) { o.BaseEndpoint = aws.String(c.S3PresignEndpoint); o.UsePathStyle = c.S3PathStyle })
	return &Store{client: client, signer: s3.NewPresignClient(public), bucket: c.S3Bucket, ttl: c.S3TTL}
}
func (s *Store) UploadURL(ctx context.Context, key, mime string, size int64) (Upload, error) {
	out, err := s.signer.PresignPutObject(ctx, &s3.PutObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key), ContentType: aws.String(mime), ContentLength: aws.Int64(size)}, func(o *s3.PresignOptions) { o.Expires = s.ttl })
	if err != nil {
		return Upload{}, err
	}
	headers := map[string]string{"Content-Type": mime}
	for k, v := range out.SignedHeader {
		if len(v) > 0 && k != "Host" && k != "Content-Length" {
			headers[k] = v[0]
		}
	}
	return Upload{URL: out.URL, Method: "PUT", Headers: headers, ExpiresAt: time.Now().Add(s.ttl)}, nil
}
func (s *Store) Read(ctx context.Context, key string) (io.ReadCloser, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)})
	if err != nil {
		return nil, err
	}
	return out.Body, nil
}
func (s *Store) Put(ctx context.Context, key, mime string, data []byte) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key), ContentType: aws.String(mime), Body: bytes.NewReader(data)})
	return err
}
func (s *Store) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)})
	return err
}
func (s *Store) ReadURL(ctx context.Context, key string) (SignedURL, error) {
	out, err := s.signer.PresignGetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)}, func(o *s3.PresignOptions) { o.Expires = s.ttl })
	if err != nil {
		return SignedURL{}, err
	}
	return SignedURL{URL: out.URL, ExpiresAt: time.Now().Add(s.ttl)}, nil
}
