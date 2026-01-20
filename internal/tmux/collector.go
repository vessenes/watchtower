package tmux

import (
	"crypto/sha256"
	"encoding/hex"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

// PaneInfo holds information about a tmux pane.
type PaneInfo struct {
	Session string `json:"session"`
	Window  string `json:"window"`
	Pane    string `json:"pane"`
	Title   string `json:"title"`
	Cols    int    `json:"cols"`
	Rows    int    `json:"rows"`
}

// PaneID returns the unique identifier for this pane (session:window.pane).
func (p PaneInfo) PaneID() string {
	return p.Session + ":" + p.Window + "." + p.Pane
}

// PaneUpdate represents a pane with its captured content.
type PaneUpdate struct {
	PaneInfo
	Content     string `json:"content"`
	ContentHash string `json:"-"`
}

// Collector polls tmux for pane information and content changes.
type Collector struct {
	socketPath    string
	sessionFilter string
	pollInterval  time.Duration

	mu          sync.RWMutex
	panes       map[string]PaneInfo
	contentHash map[string]string

	updates chan PaneUpdate
	stop    chan struct{}
}

// NewCollector creates a new tmux collector.
func NewCollector(socketPath, sessionFilter string, pollInterval time.Duration) *Collector {
	return &Collector{
		socketPath:    socketPath,
		sessionFilter: sessionFilter,
		pollInterval:  pollInterval,
		panes:         make(map[string]PaneInfo),
		contentHash:   make(map[string]string),
		updates:       make(chan PaneUpdate, 100),
		stop:          make(chan struct{}),
	}
}

// Updates returns a channel of pane updates.
func (c *Collector) Updates() <-chan PaneUpdate {
	return c.updates
}

// ListPanes returns all tmux panes matching the session filter.
func (c *Collector) ListPanes() ([]PaneInfo, error) {
	// Format: session_name:window_index.pane_index:pane_title:pane_width:pane_height
	format := "#{session_name}:#{window_index}.#{pane_index}:#{pane_title}:#{pane_width}:#{pane_height}"

	args := []string{"list-panes", "-a", "-F", format}
	if c.socketPath != "" {
		args = append([]string{"-S", c.socketPath}, args...)
	}

	cmd := exec.Command("tmux", args...)
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var panes []PaneInfo
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}

		pane, ok := parsePaneLine(line)
		if !ok {
			continue
		}

		// Apply session filter
		if c.sessionFilter != "" && !matchSessionFilter(pane.Session, c.sessionFilter) {
			continue
		}

		panes = append(panes, pane)
	}

	return panes, nil
}

// CapturePane captures the content of a specific pane.
func (c *Collector) CapturePane(paneID string) (string, error) {
	args := []string{"capture-pane", "-p", "-t", paneID}
	if c.socketPath != "" {
		args = append([]string{"-S", c.socketPath}, args...)
	}

	cmd := exec.Command("tmux", args...)
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}

	return string(out), nil
}

// Start begins polling for pane changes.
func (c *Collector) Start() {
	go c.poll()
}

// Stop stops the collector.
func (c *Collector) Stop() {
	close(c.stop)
}

func (c *Collector) poll() {
	ticker := time.NewTicker(c.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-c.stop:
			return
		case <-ticker.C:
			c.collectUpdates()
		}
	}
}

func (c *Collector) collectUpdates() {
	panes, err := c.ListPanes()
	if err != nil {
		return
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	// Track current panes
	currentPanes := make(map[string]bool)
	for _, pane := range panes {
		paneID := pane.PaneID()
		currentPanes[paneID] = true
		c.panes[paneID] = pane

		// Capture content and check for changes
		content, err := c.CapturePane(paneID)
		if err != nil {
			continue
		}

		hash := hashContent(content)
		if oldHash, exists := c.contentHash[paneID]; !exists || oldHash != hash {
			c.contentHash[paneID] = hash

			select {
			case c.updates <- PaneUpdate{
				PaneInfo:    pane,
				Content:     content,
				ContentHash: hash,
			}:
			default:
				// Channel full, drop update
			}
		}
	}

	// Clean up removed panes
	for paneID := range c.panes {
		if !currentPanes[paneID] {
			delete(c.panes, paneID)
			delete(c.contentHash, paneID)
		}
	}
}

// Panes returns the current list of panes.
func (c *Collector) Panes() []PaneInfo {
	c.mu.RLock()
	defer c.mu.RUnlock()

	panes := make([]PaneInfo, 0, len(c.panes))
	for _, p := range c.panes {
		panes = append(panes, p)
	}
	return panes
}

func parsePaneLine(line string) (PaneInfo, bool) {
	// Format: session:window.pane:title:width:height
	// Example: gt-main:0.0:zsh:80:24
	parts := strings.SplitN(line, ":", 5)
	if len(parts) < 5 {
		return PaneInfo{}, false
	}

	session := parts[0]
	windowPane := parts[1]
	title := parts[2]
	widthStr := parts[3]
	heightStr := parts[4]

	// Parse window.pane
	dotIdx := strings.Index(windowPane, ".")
	if dotIdx == -1 {
		return PaneInfo{}, false
	}
	window := windowPane[:dotIdx]
	pane := windowPane[dotIdx+1:]

	cols, _ := strconv.Atoi(widthStr)
	rows, _ := strconv.Atoi(heightStr)

	return PaneInfo{
		Session: session,
		Window:  window,
		Pane:    pane,
		Title:   title,
		Cols:    cols,
		Rows:    rows,
	}, true
}

func matchSessionFilter(session, pattern string) bool {
	if pattern == "" {
		return true
	}
	matched, _ := filepath.Match(pattern, session)
	return matched
}

func hashContent(content string) string {
	h := sha256.Sum256([]byte(content))
	return hex.EncodeToString(h[:8]) // Use first 8 bytes for shorter hash
}
