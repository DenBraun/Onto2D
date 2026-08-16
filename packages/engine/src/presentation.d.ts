import type { ModelPack } from "@onto2d/model-pack";
import type { ModelPackRegistryResolution } from "@onto2d/model-pack/registry";
import type {
  LazyModelPresentation,
  ModelPresentationOptions
} from "@onto2d/view/lazy";

export interface VerifiedModelPresentationOptions extends ModelPresentationOptions {
  resolution?: ModelPackRegistryResolution;
}

export function createVerifiedModelPresentation(
  pack: ModelPack,
  options?: VerifiedModelPresentationOptions
): LazyModelPresentation;
