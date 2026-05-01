package code

import (
	"strings"

	"github.com/google/uuid"
)

func Generate() string {
	return strings.ToUpper(strings.ReplaceAll(uuid.NewString(), "-", ""))[:8]
}
