package tmux

import (
	"testing"
)

func TestParsePaneLine(t *testing.T) {
	tests := []struct {
		name   string
		line   string
		want   PaneInfo
		wantOK bool
	}{
		{
			name: "valid line",
			line: "gt-main:0.0:zsh:80:24",
			want: PaneInfo{
				Session: "gt-main",
				Window:  "0",
				Pane:    "0",
				Title:   "zsh",
				Cols:    80,
				Rows:    24,
			},
			wantOK: true,
		},
		{
			name: "with vim title",
			line: "gt-work:1.2:vim:120:40",
			want: PaneInfo{
				Session: "gt-work",
				Window:  "1",
				Pane:    "2",
				Title:   "vim",
				Cols:    120,
				Rows:    40,
			},
			wantOK: true,
		},
		{
			name:   "invalid - missing parts",
			line:   "gt-main:0.0",
			want:   PaneInfo{},
			wantOK: false,
		},
		{
			name:   "invalid - no colon",
			line:   "invalid",
			want:   PaneInfo{},
			wantOK: false,
		},
		{
			name:   "invalid - no dot in window.pane",
			line:   "gt-main:0:zsh:80:24",
			want:   PaneInfo{},
			wantOK: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := parsePaneLine(tt.line)
			if ok != tt.wantOK {
				t.Errorf("parsePaneLine() ok = %v, want %v", ok, tt.wantOK)
				return
			}
			if ok && got != tt.want {
				t.Errorf("parsePaneLine() = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestMatchSessionFilter(t *testing.T) {
	tests := []struct {
		session string
		pattern string
		want    bool
	}{
		{"gt-main", "gt-*", true},
		{"gt-work", "gt-*", true},
		{"other", "gt-*", false},
		{"anything", "", true},
		{"gt-main", "gt-main", true},
		{"gt-main", "gt-work", false},
	}

	for _, tt := range tests {
		t.Run(tt.session+"_"+tt.pattern, func(t *testing.T) {
			got := matchSessionFilter(tt.session, tt.pattern)
			if got != tt.want {
				t.Errorf("matchSessionFilter(%q, %q) = %v, want %v",
					tt.session, tt.pattern, got, tt.want)
			}
		})
	}
}

func TestPaneID(t *testing.T) {
	p := PaneInfo{
		Session: "main",
		Window:  "1",
		Pane:    "2",
	}
	want := "main:1.2"
	if got := p.PaneID(); got != want {
		t.Errorf("PaneID() = %q, want %q", got, want)
	}
}

func TestHashContent(t *testing.T) {
	// Same content should produce same hash
	h1 := hashContent("hello world")
	h2 := hashContent("hello world")
	if h1 != h2 {
		t.Error("Same content should produce same hash")
	}

	// Different content should produce different hash
	h3 := hashContent("hello world!")
	if h1 == h3 {
		t.Error("Different content should produce different hash")
	}

	// Hash should be 16 chars (8 bytes hex encoded)
	if len(h1) != 16 {
		t.Errorf("Hash length = %d, want 16", len(h1))
	}
}

func TestNewCollector(t *testing.T) {
	c := NewCollector("/tmp/tmux.sock", "gt-*", 100)
	if c == nil {
		t.Fatal("NewCollector returned nil")
	}
	if c.socketPath != "/tmp/tmux.sock" {
		t.Errorf("socketPath = %q, want %q", c.socketPath, "/tmp/tmux.sock")
	}
	if c.sessionFilter != "gt-*" {
		t.Errorf("sessionFilter = %q, want %q", c.sessionFilter, "gt-*")
	}
}
