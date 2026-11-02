package preview

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/gif"
	"os/exec"
	"testing"
)

func TestAnimatedKeepsAnimationAndRejectsInvalidInput(t *testing.T) {
	if _, err := exec.LookPath("gif2webp"); err != nil {
		t.Skip("libwebp gif2webp is not installed")
	}
	palette := color.Palette{color.Transparent, color.White}
	frames := []*image.Paletted{image.NewPaletted(image.Rect(0, 0, 100, 100), palette), image.NewPaletted(image.Rect(0, 0, 100, 100), palette)}
	frames[1].SetColorIndex(1, 1, 1)
	var source bytes.Buffer
	if err := gif.EncodeAll(&source, &gif.GIF{Image: frames, Delay: []int{10, 20}, LoopCount: 0}); err != nil {
		t.Fatal(err)
	}
	encoded, err := Animated(context.Background(), source.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(encoded, []byte("ANIM")) || bytes.Count(encoded, []byte("ANMF")) != 2 {
		t.Fatal("animation frames were lost")
	}
	if _, err = Animated(context.Background(), []byte("not an image")); err == nil {
		t.Fatal("invalid input accepted")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err = Animated(ctx, source.Bytes()); err == nil {
		t.Fatal("cancelled conversion succeeded")
	}
}
