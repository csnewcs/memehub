package preview

import (
	"bytes"
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

// Animated keeps GIF frames and timing while compressing the gallery copy.
// gif2webp is provided by the official libwebp tools package.
func Animated(ctx context.Context, data []byte) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()
	dir, err := os.MkdirTemp("", "memehub-preview-*")
	if err != nil {
		return nil, errors.New("preview_generation_failed")
	}
	defer os.RemoveAll(dir)
	input, output := filepath.Join(dir, "source.gif"), filepath.Join(dir, "preview.webp")
	if err = os.WriteFile(input, data, 0600); err != nil {
		return nil, errors.New("preview_generation_failed")
	}
	cmd := exec.CommandContext(ctx, "gif2webp", "-quiet", "-lossy", "-q", "65", "-m", "4", input, "-o", output)
	if err = cmd.Run(); err != nil {
		return nil, errors.New("preview_generation_failed")
	}
	info, err := os.Stat(output)
	if err != nil || info.Size() > 10<<20 {
		return nil, errors.New("preview_generation_failed")
	}
	encoded, err := os.ReadFile(output)
	if err != nil || len(encoded) < 12 || !bytes.Equal(encoded[:4], []byte("RIFF")) || !bytes.Equal(encoded[8:12], []byte("WEBP")) {
		return nil, errors.New("preview_generation_failed")
	}
	return encoded, nil
}
