{
  description = "RapidRAW - A blazingly-fast, non-destructive, and GPU-accelerated RAW image editor";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs {
          inherit system overlays;
        };

        # Pre-fetch ONNX Runtime to avoid downloading during build
        onnxRuntimeTgz = pkgs.fetchurl {
          url = "https://github.com/microsoft/onnxruntime/releases/download/v1.16.0/onnxruntime-linux-x64-1.16.0.tgz";
          sha256 = "sha256-I9hn6yp3jdVMYBd45dK89FzrdsWoLMAUQFPIP10fAAU=";
        };

        # Rust toolchain
        rustToolchain = pkgs.rust-bin.stable.latest.default.override {
          extensions = [ "rust-src" "rust-analyzer" ];
          targets = [ "wasm32-unknown-unknown" ];
        };

        # Dependencies for Tauri development
        tauriDeps = with pkgs; [
          # Base dependencies
          pkg-config
          openssl.dev

          # Linux specific dependencies
          libsoup_2_4
          gtk3
          glib
          gdk-pixbuf

          # For windowing
          libappindicator
          cairo
          pango
          xorg.libX11
          xorg.libXi
          xorg.libXcursor
          xorg.libXext
          xorg.libXrandr
          xorg.libXrender
          xorg.libxcb
          xorg.libXfixes
          libxkbcommon

          # For GPU acceleration
          vulkan-loader
          vulkan-tools
          vulkan-validation-layers

          # webkit2gtk
          webkitgtk_4_1

          # Libraries needed by rawler
          libjpeg
          libpng
          zlib

          # For ONNX Runtime
          libGL

          # tauri cli
          cargo-tauri
        ];

        # Node.js dependencies
        nodeDeps = with pkgs; [
          nodejs_20
          nodePackages.pnpm
          nodePackages.npm
        ];

        # System libraries
        systemLibs = with pkgs; [
          curl
          openssl
          sqlite
          glib
          dbus

          # For trash functionality
          gvfs

          # For image processing
          libheif
          imagemagick
        ];

        # Build RapidRAW package using cargo-tauri.hook
        rapidRAW = pkgs.rustPlatform.buildRustPackage (finalAttrs: {
          pname = "rapidraw"; # Keep package name lowercase for Nix conventions
          version = "0.0.0";
          src = self;

          # You'll need to generate the hash with:
          # nix hash-path --type sha256 --base32 $(nix-build -E '((import <nixpkgs> {}).fetchCargoTarball { src = ./.; })' 2>/dev/null)
          cargoHash = "sha256-Cyh8VPUOxAV8EblSXeuYCx5bVTfwZnWh8NxqlcQoiFI="; # Replace with actual hash

          # Generate this hash with:
          # nix run nixpkgs#prefetch-npm-deps -- package-lock.json
          npmDeps = pkgs.fetchNpmDeps {
            name = "${finalAttrs.pname}-${finalAttrs.version}-npm-deps";
            inherit (finalAttrs) src;
            hash = "sha256-RKSYhvb/bciChIlEyBZzdsBH+6bTUWcWmBMIZ9Ri+0k="; # Replace with actual hash
          };

          nativeBuildInputs = with pkgs; [
            # Tauri hook
            cargo-tauri.hook

            # Node.js setup
            nodejs_20
            npmHooks.npmConfigHook

            # Library detection
            pkg-config

            # Linux specific
            wrapGAppsHook4
          ];

          buildInputs = with pkgs; [
            # Linux specific dependencies
            glib-networking
            openssl
            webkitgtk_4_1
            gtk3
            glib
            gdk-pixbuf
            libappindicator
            cairo
            pango
            xorg.libX11
            xorg.libXi
            xorg.libXcursor
            xorg.libXext
            xorg.libXrandr
            xorg.libXrender
            xorg.libxcb
            xorg.libXfixes
            libxkbcommon
            vulkan-loader
            libjpeg
            libpng
            zlib
            libGL
            dbus
            gvfs
            libheif
          ];

          # Set our Tauri source directory
          cargoRoot = "src-tauri";
          # And make sure we build there too
          buildAndTestSubdir = "src-tauri";

          # Pre-build hook to copy ONNX Runtime to the expected location
          preBuild = ''
            mkdir -p target/x86_64-unknown-linux-gnu/release/build/ort-bbfe144039eb506f/out/
            cp ${onnxRuntimeTgz} target/x86_64-unknown-linux-gnu/release/build/ort-bbfe144039eb506f/out/onnxruntime-linux-x64-1.16.0.tgz
          '';

          # Environment variables for ONNX Runtime and build
          CARGO_FEATURE_LOAD_DYNAMIC = "1";
          ORT_STRATEGY = "download";
          ORT_LIB_LOCATION = onnxRuntimeTgz;
          XDG_DATA_DIRS = "${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}";

          # Post-installation steps to create desktop entries and copy icons
          postInstall = ''
            # Create a symlink for lowercase name
            ln -s $out/bin/RapidRAW $out/bin/rapidraw

            # Create desktop entry
            mkdir -p $out/share/applications
            cat > $out/share/applications/rapidraw.desktop << EOF
            [Desktop Entry]
            Name=RapidRAW
            Exec=rapidraw
            Icon=rapidraw
            Type=Application
            Categories=Graphics;Photography;
            Comment=A blazingly-fast, non-destructive, and GPU-accelerated RAW image editor
            EOF

            # Copy icons
            mkdir -p $out/share/icons/hicolor/128x128/apps
            cp $src/src-tauri/icons/128x128.png $out/share/icons/hicolor/128x128/apps/rapidraw.png
          '';

          meta = with pkgs.lib; {
            description = "A blazingly-fast, non-destructive, and GPU-accelerated RAW image editor built with performance in mind";
            homepage = "https://github.com/CyberTimon/RapidRAW";
            license = licenses.mit;
            mainProgram = "rapidraw";
            maintainers = [ ];
            platforms = platforms.linux ++ platforms.darwin;
          };
        });

      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            rustToolchain
          ] ++ tauriDeps ++ nodeDeps ++ systemLibs;

          shellHook = ''
            export LD_LIBRARY_PATH=${pkgs.lib.makeLibraryPath systemLibs}:$LD_LIBRARY_PATH
            export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}:$XDG_DATA_DIRS"
            export RUST_SRC_PATH=${rustToolchain}/lib/rustlib/src/rust/library
            export PKG_CONFIG_PATH="${pkgs.openssl.dev}/lib/pkgconfig:$PKG_CONFIG_PATH"

            # Create alias for cargo-tauri to tauri
            alias tauri="cargo tauri"

            # Pre-fetch ONNX Runtime for development
            export ORT_STRATEGY="download"
            export ORT_LIB_LOCATION="${onnxRuntimeTgz}"
          '';
        };

        # Use only the cargo-tauri.hook approach
        packages.default = rapidRAW;

        # Add app to make 'nix run' work
        apps.default = flake-utils.lib.mkApp {
          drv = self.packages.${system}.default;
          name = "rapidraw";
        };
      }
    );
}
