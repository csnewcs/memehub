package storage

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/noeulnight/memehub/apps/api/internal/config"
)

const localPrefix = "/api/demo/storage/"

type localStore struct {
	dir, baseURL string
	secret       [32]byte
	ttl          time.Duration
	maxBytes     int64
}

// NewLocal is deliberately restricted to explicit, non-production demo mode.
func NewLocal(c config.Config) (*Store, error) {
	if !c.DemoMode || (c.Env != "development" && c.Env != "test") {
		return nil, errors.New("local storage requires development or test demo mode")
	}
	if c.DemoDataDir == "" {
		return nil, errors.New("DEMO_DATA_DIR is required")
	}
	dir, err := filepath.Abs(c.DemoDataDir)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	l := &localStore{dir: dir, baseURL: strings.TrimRight(c.AppBaseURL, "/"), ttl: c.S3TTL, maxBytes: c.UploadMaxBytes}
	if _, err := rand.Read(l.secret[:]); err != nil {
		return nil, err
	}
	return &Store{local: l}, nil
}

func validLocalKey(key string) bool {
	return fs.ValidPath(key) && key != "." && !strings.ContainsAny(key, "\\\x00")
}

func (l *localStore) root(key string) (*os.Root, error) {
	if !validLocalKey(key) {
		return nil, errors.New("invalid storage key")
	}
	// os.Root also prevents symlinks from escaping the data directory.
	return os.OpenRoot(l.dir)
}

func (l *localStore) read(key string) (*os.File, error) {
	root, err := l.root(key)
	if err != nil {
		return nil, err
	}
	defer root.Close()
	return root.Open(key)
}

func (l *localStore) put(key string, data []byte) error {
	root, err := l.root(key)
	if err != nil {
		return err
	}
	defer root.Close()
	if err := root.MkdirAll(path.Dir(key), 0700); err != nil {
		return err
	}
	var token [16]byte
	if _, err := rand.Read(token[:]); err != nil {
		return err
	}
	tmp := path.Dir(key) + "/.upload-" + hex.EncodeToString(token[:])
	f, err := root.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return err
	}
	defer root.Remove(tmp)
	_, writeErr := f.Write(data)
	closeErr := f.Close()
	if writeErr != nil {
		return writeErr
	}
	if closeErr != nil {
		return closeErr
	}
	return root.Rename(tmp, key)
}

func (l *localStore) delete(key string) error {
	root, err := l.root(key)
	if err != nil {
		return err
	}
	defer root.Close()
	err = root.Remove(key)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	return err
}

func (l *localStore) signature(method, key string, q url.Values) string {
	mac := hmac.New(sha256.New, l.secret[:])
	for _, value := range []string{method, key, q.Get("expires"), q.Get("mime"), q.Get("size")} {
		_, _ = io.WriteString(mac, value+"\n")
	}
	return hex.EncodeToString(mac.Sum(nil))
}

func (l *localStore) signedURL(method, key, mime string, size int64) (SignedURL, error) {
	if !validLocalKey(key) || strings.ContainsAny(mime, "\r\n") {
		return SignedURL{}, errors.New("invalid storage key or MIME type")
	}
	expires := time.Now().Add(l.ttl)
	q := url.Values{"expires": {strconv.FormatInt(expires.Unix(), 10)}, "mime": {mime}, "size": {strconv.FormatInt(size, 10)}}
	q.Set("signature", l.signature(method, key, q))
	return SignedURL{URL: l.baseURL + localPrefix + key + "?" + q.Encode(), ExpiresAt: expires}, nil
}

func (l *localStore) uploadURL(key, mime string, size int64) (Upload, error) {
	if !strings.HasPrefix(key, "staging/") || size < 1 || size > l.maxBytes {
		return Upload{}, errors.New("invalid upload")
	}
	signed, err := l.signedURL("PUT", key, mime, size)
	if err != nil {
		return Upload{}, err
	}
	return Upload{URL: signed.URL, Method: "PUT", Headers: map[string]string{"Content-Type": mime}, ExpiresAt: signed.ExpiresAt}, nil
}

// LocalHandler exposes only signed, expiring object URLs, never a directory listing.
func (s *Store) LocalHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.local == nil {
			http.NotFound(w, r)
			return
		}
		l := s.local
		key := strings.TrimPrefix(r.URL.Path, localPrefix)
		q := r.URL.Query()
		expires, err := strconv.ParseInt(q.Get("expires"), 10, 64)
		if !strings.HasPrefix(r.URL.Path, localPrefix) || !validLocalKey(key) || err != nil || time.Now().Unix() >= expires || !hmac.Equal([]byte(q.Get("signature")), []byte(l.signature(r.Method, key, q))) {
			http.Error(w, "invalid or expired storage URL", http.StatusForbidden)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		switch r.Method {
		case http.MethodPut:
			size, err := strconv.ParseInt(q.Get("size"), 10, 64)
			if err != nil || size < 1 || size > l.maxBytes || !strings.HasPrefix(key, "staging/") || r.Header.Get("Content-Type") != q.Get("mime") {
				http.Error(w, "invalid upload", http.StatusBadRequest)
				return
			}
			data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, size))
			if err != nil || int64(len(data)) != size {
				http.Error(w, "invalid upload size", http.StatusBadRequest)
				return
			}
			if err := l.put(key, data); err != nil {
				http.Error(w, "cannot save upload", http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)
		case http.MethodGet:
			f, err := l.read(key)
			if err != nil {
				http.NotFound(w, r)
				return
			}
			defer f.Close()
			stat, err := f.Stat()
			if err != nil || !stat.Mode().IsRegular() {
				http.NotFound(w, r)
				return
			}
			http.ServeContent(w, r, path.Base(key), stat.ModTime(), f)
		default:
			w.Header().Set("Allow", "GET, PUT")
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
}
