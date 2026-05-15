const std = @import("std");
const napigen = @import("napigen");
const TerminalBuildOptions = @import(".ghostty-src/src/terminal/build_options.zig").Options;

const GeneratedTables = struct {
    props: std.Build.LazyPath,
    symbols: std.Build.LazyPath,
};

fn generateGhosttyUnicodeTables(
    b: *std.Build,
    host_uucode: *std.Build.Dependency,
) GeneratedTables {
    const props_exe = b.addExecutable(.{
        .name = "ghostty-props-unigen",
        .root_module = b.createModule(.{
            .root_source_file = b.path(".ghostty-src/src/unicode/props_uucode.zig"),
            .target = b.graph.host,
            .optimize = .Debug,
        }),
        .use_llvm = true,
    });
    props_exe.root_module.addImport("uucode", host_uucode.module("uucode"));

    const symbols_exe = b.addExecutable(.{
        .name = "ghostty-symbols-unigen",
        .root_module = b.createModule(.{
            .root_source_file = b.path(".ghostty-src/src/unicode/symbols_uucode.zig"),
            .target = b.graph.host,
            .optimize = .Debug,
        }),
        .use_llvm = true,
    });
    symbols_exe.root_module.addImport("uucode", host_uucode.module("uucode"));

    const props_run = b.addRunArtifact(props_exe);
    const symbols_run = b.addRunArtifact(symbols_exe);
    const wf = b.addWriteFiles();
    return .{
        .props = wf.addCopyFile(props_run.captureStdOut(), "props.zig"),
        .symbols = wf.addCopyFile(symbols_run.captureStdOut(), "symbols.zig"),
    };
}

pub fn build(b: *std.Build) !void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const host_uucode = b.dependency("uucode", .{
        .target = b.graph.host,
        .optimize = .Debug,
        .build_config_path = b.path(".ghostty-src/src/build/uucode_config.zig"),
    });
    const tables = generateGhosttyUnicodeTables(b, host_uucode);

    const ghostty_module = b.createModule(.{
        .root_source_file = b.path(".ghostty-src/src/lib_vt.zig"),
        .target = target,
        .optimize = optimize,
    });

    const build_options = b.addOptions();
    build_options.addOption(bool, "simd", false);
    ghostty_module.addOptions("build_options", build_options);

    const terminal_options: TerminalBuildOptions = .{
        .artifact = .lib,
        .oniguruma = false,
        .simd = false,
        .slow_runtime_safety = false,
        .c_abi = false,
    };
    terminal_options.add(b, ghostty_module);

    ghostty_module.addAnonymousImport("unicode_tables", .{
        .root_source_file = tables.props,
    });
    ghostty_module.addAnonymousImport("symbols_tables", .{
        .root_source_file = tables.symbols,
    });

    const target_uucode = b.dependency("uucode", .{
        .target = target,
        .optimize = optimize,
        .build_config_path = b.path(".ghostty-src/src/build/uucode_config.zig"),
    });
    ghostty_module.addImport("uucode", target_uucode.module("uucode"));

    const root_module = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
        .link_libc = true,
    });
    root_module.addImport("ghostty", ghostty_module);

    const lib = b.addLibrary(.{
        .linkage = .dynamic,
        .name = "termless_ghostty_native",
        .root_module = root_module,
    });

    if (lib.rootModuleTarget().os.tag.isDarwin()) {
        lib.use_llvm = true;
        lib.headerpad_max_install_names = true;
    }

    napigen.setup(lib);
    b.installArtifact(lib);

    const copy_node = b.addInstallLibFile(
        lib.getEmittedBin(),
        "termless-ghostty-native.node",
    );
    b.getInstallStep().dependOn(&copy_node.step);
}
