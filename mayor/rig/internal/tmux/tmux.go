package tmux

// Collector handles tmux session enumeration and pane capture.
type Collector struct{}

// New creates a new tmux Collector.
func New() *Collector {
	return &Collector{}
}
