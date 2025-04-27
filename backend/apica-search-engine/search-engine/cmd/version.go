package cmd

import (
	"fmt"
	"github.com/spf13/cobra"

	"github.com/vsnakul/apica-search-engine/search-engine/version"
)

func init() {
	RootCmd.AddCommand(versionCmd)
}

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print the version",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println(version.Version)
	},
}
