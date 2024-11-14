{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  packages = [
    pkgs.go
    pkgs.python311
    pkgs.python311Packages.tensorflow
    pkgs.python311Packages.keras
    pkgs.python311Packages.numpy
    pkgs.gcc
  ];
  inputsFrom = [
    # pkgs.gcc
    pkgs.glibc
  ];

  # inputsFrom = [ pkgs.hello pkgs.gnutar ];

  shellHook = ''
  alias cc=gcc
  '';
}
