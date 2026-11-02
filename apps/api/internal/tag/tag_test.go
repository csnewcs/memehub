package tag

import "testing"

func TestNormalization(t *testing.T) {
	for _, value := range []string{" 반응 짤 ", "반응\t\n짤", "반응\u00a0\u2003\u3000짤"} {
		if Name(value) != "반응짤" || Key(value) != "반응짤" {
			t.Errorf("whitespace retained: %q", value)
		}
	}
	if Name(" Work Life ") != "WorkLife" || Key("Work Life") != "worklife" {
		t.Fatal("case normalization")
	}
	if Name("\t\n\u00a0") != "" {
		t.Fatal("whitespace-only tag")
	}
	if Name("가 ᆷ") != "감" {
		t.Fatal("NFC normalization")
	}
}
