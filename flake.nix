{
  description = "Environment for developing learnhouse";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = import nixpkgs {
        inherit system;
        config.allowUnfree = true;
      };
    in {
      devShells.default = pkgs.mkShell {
        name = "Learnhouse Dev";

        buildInputs = with pkgs; [
            # Misc
            pkgs.ripgrep
            pkgs.poetry
            pkgs.stdenv.cc.cc.lib
            pkgs.pnpm
            pkgs.pm2
        ];

        LD_LIBRARY_PATH = "${pkgs.stdenv.cc.cc.lib}/lib";
        MAKEFLAGS = "-j 2";

        shellHook = ''
          # if running from zsh, reenter zsh
          if [[ $(ps -e | grep $PPID) == *"zsh" ]]; then
            export SHELL=zsh
            zsh
            exit
          fi
        '';
      };

      formatter = nixpkgs.legacyPackages.${system}.alejandra;
    });
}
