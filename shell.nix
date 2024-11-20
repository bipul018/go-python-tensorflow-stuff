# shell.nix
let
  pkgs = import <nixpkgs> {};
in pkgs.mkShell {
  packages = [
    pkgs.python311Full
    pkgs.python311Packages.virtualenv

    pkgs.go
    pkgs.python311Packages.tensorflow
    pkgs.python311Packages.keras
    pkgs.python311Packages.numpy

    pkgs.gcc


    # all pytorch stuff from colab notebook
    pkgs.python311Packages.torch
    pkgs.python311Packages.pandas
    pkgs.python311Packages.pyarrow
    pkgs.python311Packages.fastparquet
    pkgs.python311Packages.scikit-learn
    pkgs.python311Packages.seaborn
    pkgs.python311Packages.tqdm
    pkgs.python311Packages.matplotlib
    pkgs.python311Packages.opencv4
    pkgs.python311Packages.protobuf
    pkgs.zlib
    pkgs.glib
    pkgs.wget
    pkgs.ffmpeg
  ];
  propagatedBuildInputs = [
    #pkgs.libffi
    pkgs.libGL
  ];
  
  buildInputs = [
    #pkgs.libffi
  ];
  inputsFrom = [
    # pkgs.gcc
    pkgs.glibc

    pkgs.gcc
    pkgs.git
  ];

  # inputsFrom = [ pkgs.hello pkgs.gnutar ];
  

  shellHook = ''
  #export LD_LIBRARY_PATH=${pkgs.libGL}/lib:$LD_LIBRARY_PATH
  #export LD_LIBRARY_PATH=${pkgs.zlib}/lib:$LD_LIBRARY_PATH
  #export LD_LIBRARY_PATH=${pkgs.glib}/lib:$LD_LIBRARY_PATH
  # export LD_LIBRARY_PATH=${pkgs.wayland}/lib:$LD_LIBRARY_PATH
  unset WAYLAND_DISPLAY

  alias py=python
  export TF_CPP_MIN_LOG_LEVEL=1
  export MPLBACKEND=TkAgg

  export VIRTUAL_ENV='./python-venv'
  export PATH="$VIRTUAL_ENV/bin:$PATH"

  # unset PYTHONHOME if set
  if ! [ -z "$\{PYTHONHOME+_\}" ] ; then
      _OLD_VIRTUAL_PYTHONHOME="$PYTHONHOME"
      unset PYTHONHOME
  fi

  export PYTHONPATH=${pkgs.python311Packages.protobuf}/lib/python3.11/site-packages:$PYTHONPATH

  '';
}
