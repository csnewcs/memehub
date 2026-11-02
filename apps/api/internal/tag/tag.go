package tag

import (
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

func Name(value string) string {
	return norm.NFC.String(strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) {
			return -1
		}
		return r
	}, value))
}
func Key(value string) string { return strings.ToLower(Name(value)) }
