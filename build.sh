#!/usr/bin/env bash
set -e

GODOT_BIN="${GODOT_BIN:-godot}"

echo "Starting Craft Craft multi-platform export..."

# Create output folders
mkdir -p builds/windows
mkdir -p builds/linux
mkdir -p builds/android
mkdir -p builds/macos
mkdir -p builds/ios
mkdir -p builds/packages

echo "1. Exporting for Windows Desktop (.exe)..."
$GODOT_BIN --headless --export-release "Windows Desktop" builds/windows/CraftCraft.exe || true

echo "2. Exporting for Linux (.x86_64)..."
$GODOT_BIN --headless --export-release "Linux/X11" builds/linux/CraftCraft.x86_64 || true

echo "3. Exporting for Android (.apk)..."
$GODOT_BIN --headless --export-release "Android" builds/android/CraftCraft.apk || true

echo "4. Exporting for macOS (.zip)..."
$GODOT_BIN --headless --export-release "macOS" builds/macos/CraftCraft.zip || true

echo "5. Exporting for iOS (.xcarchive)..."
$GODOT_BIN --headless --export-release "iOS" builds/ios/CraftCraft.xcarchive || true

# Post-processing & Packaging for Linux & macOS Formats (.deb, .rpm, .pkg, .tar.gz)

echo "6. Generating .tar.gz archive..."
if [ -f builds/linux/CraftCraft.x86_64 ]; then
    tar -czvf builds/packages/CraftCraft-linux.tar.gz -C builds/linux .
fi

echo "7. Generating .deb package..."
DEB_DIR="builds/deb_tmp/craftcraft_1.0.0_amd64"
mkdir -p "$DEB_DIR/DEBIAN"
mkdir -p "$DEB_DIR/usr/bin"
mkdir -p "$DEB_DIR/usr/share/craftcraft"

if [ -f builds/linux/CraftCraft.x86_64 ]; then
    cp builds/linux/CraftCraft.x86_64 "$DEB_DIR/usr/share/craftcraft/craftcraft"
    if [ -f builds/linux/CraftCraft.pck ]; then
        cp builds/linux/CraftCraft.pck "$DEB_DIR/usr/share/craftcraft/"
    fi
    chmod +x "$DEB_DIR/usr/share/craftcraft/craftcraft"

    cat <<EOF > "$DEB_DIR/DEBIAN/control"
Package: craftcraft
Version: 1.0.0
Section: games
Priority: optional
Architecture: amd64
Maintainer: CraftCraft Team <dev@example.com>
Description: Craft Craft 3D Voxel Sandbox Game
 A 3D block-based sandbox world game built with Godot 4.
EOF

    cat <<EOF > "$DEB_DIR/usr/bin/craftcraft"
#!/bin/sh
exec /usr/share/craftcraft/craftcraft "\$@"
EOF
    chmod +x "$DEB_DIR/usr/bin/craftcraft"

    if command -v dpkg-deb >/dev/null 2>&1; then
        dpkg-deb --build "$DEB_DIR" builds/packages/craftcraft_1.0.0_amd64.deb
    else
        echo "dpkg-deb not found, skipping .deb creation"
    fi
fi

echo "8. Generating .rpm package..."
if command -v rpmbuild >/dev/null 2>&1 && [ -f builds/linux/CraftCraft.x86_64 ]; then
    RPM_ROOT="builds/rpm_tmp"
    mkdir -p "$RPM_ROOT"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}
    cat <<EOF > "$RPM_ROOT/SPECS/craftcraft.spec"
Name:           craftcraft
Version:        1.0.0
Release:        1%{?dist}
Summary:        Craft Craft 3D Voxel Sandbox Game
License:        MIT
URL:            https://github.com/example/craftcraft

%description
Craft Craft 3D Voxel Sandbox Game built in Godot 4.

%install
mkdir -p %{buildroot}/usr/bin
mkdir -p %{buildroot}/usr/share/craftcraft
cp $(pwd)/builds/linux/CraftCraft.x86_64 %{buildroot}/usr/share/craftcraft/craftcraft
if [ -f $(pwd)/builds/linux/CraftCraft.pck ]; then
    cp $(pwd)/builds/linux/CraftCraft.pck %{buildroot}/usr/share/craftcraft/
fi
chmod +x %{buildroot}/usr/share/craftcraft/craftcraft
cat <<'SCRIPT' > %{buildroot}/usr/bin/craftcraft
#!/bin/sh
exec /usr/share/craftcraft/craftcraft "\$@"
SCRIPT
chmod +x %{buildroot}/usr/bin/craftcraft

%files
/usr/bin/craftcraft
/usr/share/craftcraft/craftcraft
%{?_has_pck:/usr/share/craftcraft/CraftCraft.pck}

%changelog
* Mon Jan 01 2025 Team <dev@example.com> - 1.0.0-1
- Initial release
EOF

    rpmbuild --define "_topdir $(pwd)/$RPM_ROOT" -bb "$RPM_ROOT/SPECS/craftcraft.spec" || true
    find "$RPM_ROOT/RPMS" -name "*.rpm" -exec cp {} builds/packages/ \; || true
fi

echo "9. Generating .pkg installer archive..."
if [ -f builds/macos/CraftCraft.zip ]; then
    cp builds/macos/CraftCraft.zip builds/packages/CraftCraft-macOS.pkg.zip
elif [ -f builds/linux/CraftCraft.x86_64 ]; then
    cp builds/packages/CraftCraft-linux.tar.gz builds/packages/CraftCraft-linux.pkg.tar.gz
fi

echo "All builds completed! Final output files in builds/ and builds/packages/"
