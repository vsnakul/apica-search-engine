package cmd

import (
	"log"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/vsnakul/apica-search-engine/search-engine/server"
)

const envPrefix = "SEARCH_ENGINE"
const defaultConfig = ".search-engine"

// config parameters
const (
	configListenAddress = "listen-address"
	configParquetPath   = "parquet-path"
)

var myViper = viper.New()

func getConfig() *server.Config {
	return &server.Config{
		ListenAddress: myViper.GetString(configListenAddress),
		ParquetPath:   myViper.GetString(configParquetPath),
	}
}

// DefaultConfig returns default configuration values
func DefaultConfig() *server.Config {
	return &server.Config{
		ListenAddress: ":8080",
		ParquetPath:   "C:\\Projects\\the-mail\\apica-search-engine\\docs",
	}
}

// RootCmd is the entrypoint for the application.
var RootCmd = &cobra.Command{
	Use:   "apica-search-engine",
	Short: "apica-search-engine",
	Long:  `The ultimate search engine`,
	Run: func(cmd *cobra.Command, args []string) {
		err := server.Run(getConfig())
		if err != nil {
			log.Printf("error: %v", err)
			os.Exit(1)
		}
	},
}

func bindViper(flag string) {
	err := myViper.BindPFlag(flag, RootCmd.PersistentFlags().Lookup(flag))
	if err != nil {
		panic(err)
	}
}

func intFlag(flag string, def int, desc string) {
	RootCmd.PersistentFlags().Int(flag, def, desc)
}

func stringFlag(flag string, def string, desc string) {
	RootCmd.PersistentFlags().String(flag, def, desc)
}

var cfgPath string

// Execute parses CLI options.
func Execute() {
	cobra.OnInitialize(initConfig)

	RootCmd.PersistentFlags().StringVar(&cfgPath, "config", "", "config file")

	// Define global flags relevant to all subcommands and bind them to
	// the viper configuration settings:

	defaultConfig := DefaultConfig()

	stringArgs := []struct {
		flag string
		def  string
		desc string
	}{
		{configListenAddress, defaultConfig.ListenAddress, "Listen address"},
		{configParquetPath, defaultConfig.ParquetPath, "Parquet path"},
	}

	for _, arg := range stringArgs {
		stringFlag(arg.flag, arg.def, arg.desc)
		bindViper(arg.flag)
	}

	if err := RootCmd.Execute(); err != nil {
		log.Printf("command error: %v", err)
		os.Exit(-1)
	}
}

func initConfig() {
	myViper.SetConfigName(defaultConfig) // name of config file (without extension)
	myViper.AddConfigPath("$HOME")       // adding home directory as first search path
	myViper.SetEnvPrefix(envPrefix)
	myViper.AutomaticEnv() // read in environment variables that match
	replacer := strings.NewReplacer(".", "_", "-", "_")
	myViper.SetEnvKeyReplacer(replacer)

	// Override default configuration search locations with a configuration
	// file specified on the command line.
	if cfgPath != "" {
		myViper.SetConfigFile(cfgPath)
		err := myViper.ReadInConfig()
		if err == nil {
			log.Printf("Using config file: %s", myViper.ConfigFileUsed())
		} else {
			log.Printf("Could not read config file: %v", err)
			os.Exit(1)
		}
	}
}
