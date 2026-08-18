let
  system = "aarch64-darwin";
  builder = "/bin/sh";
  outputHash = builtins.hashFile "sha256" ./output.txt;

  input = name: role: builtins.derivation {
    inherit name system builder;
    args = [ "-c" "printf '%s\\n' ${role} > \"$out\"" ];
    fixtureRole = role;
  };

  sharedLeaf = input "onto2d-shared-leaf" "shared-leaf";
  sharedInput = builtins.derivation {
    name = "onto2d-shared-input";
    inherit system builder;
    args = [ "-c" "printf '%s\\n' shared > \"$out\"" ];
    fixtureRole = "shared";
    leaf = sharedLeaf;
  };
  leftInput = input "onto2d-left-input" "left-only";
  rightInput = input "onto2d-right-input" "right-only";

  fixed = extra: builtins.derivation ({
    name = "onto2d-identical-output";
    inherit system builder outputHash;
    outputHashAlgo = "sha256";
    outputHashMode = "flat";
    args = [ "-c" "printf '%s\\n' 'Onto2D Nix identity fixture' 'same bytes, distinct derivations' > \"$out\"" ];
  } // extra);

  flagshipLeft = fixed {
    fixtureVariant = "flagship-left";
    sourceUri = "https://mirror-a.invalid/onto2d-output.txt";
    shared = sharedInput;
    route = leftInput;
  };

  flagshipRight = fixed {
    fixtureVariant = "flagship-right";
    sourceUri = "https://mirror-b.invalid/onto2d-output.txt";
    shared = sharedInput;
    route = rightInput;
  };

  environmentBase = fixed {
    fixtureVariant = "environment-base";
    normalizationProbe = "baseline";
    shared = sharedInput;
  };

  environmentMutated = fixed {
    fixtureVariant = "environment-mutated";
    normalizationProbe = "mutated";
    shared = sharedInput;
  };

  inputAddressed = builtins.derivation {
    name = "onto2d-identical-output";
    inherit system builder;
    args = [ "-c" "printf '%s\\n' 'Onto2D Nix identity fixture' 'same bytes, distinct derivations' > \"$out\"" ];
    expectedContentSha256 = outputHash;
    fixtureVariant = "input-addressed-unrealized";
    shared = sharedInput;
  };
in {
  inherit
    sharedLeaf
    sharedInput
    leftInput
    rightInput
    flagshipLeft
    flagshipRight
    environmentBase
    environmentMutated
    inputAddressed;
}
