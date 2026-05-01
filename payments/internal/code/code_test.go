package code

import (
	"regexp"
	"testing"
)

func TestGenerateFormat(t *testing.T) {
	t.Parallel()

	pattern := regexp.MustCompile(`^[A-Z0-9]{8}$`)
	generated := Generate()
	if !pattern.MatchString(generated) {
		t.Fatalf("generated code %q does not match format", generated)
	}
}

func TestGenerateUniqueness(t *testing.T) {
	t.Parallel()

	seen := make(map[string]struct{}, 1000)
	for range 1000 {
		generated := Generate()
		if _, exists := seen[generated]; exists {
			t.Fatalf("duplicate code generated: %s", generated)
		}
		seen[generated] = struct{}{}
	}
}
