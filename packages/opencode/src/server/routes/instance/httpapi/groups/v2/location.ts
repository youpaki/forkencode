import { Catalog } from "@forkencode/core/catalog"
import { Location } from "@forkencode/core/location"
import { LocationServiceMap } from "@forkencode/core/location-layer"
import { LocationFileSystem } from "@forkencode/core/location-filesystem"
import { PermissionV2 } from "@forkencode/core/permission"
import { ProjectReference } from "@forkencode/core/project-reference"
import { AbsolutePath } from "@forkencode/core/schema"
import { PluginBoot } from "@forkencode/core/plugin/boot"
import { Effect, Layer, Schema } from "effect"
import { HttpServerRequest } from "effect/unstable/http"
import { HttpApiMiddleware, OpenApi } from "effect/unstable/httpapi"

export const LocationQuery = Schema.Struct({
  location: Schema.optional(
    Schema.Struct({
      directory: Schema.optional(Schema.String),
      workspace: Schema.optional(Schema.String),
    }),
  ),
}).annotate({ identifier: "V2LocationQuery" })

export const locationQueryOpenApi = OpenApi.annotations({
  transform: (operation) => {
    const parameters = operation.parameters
    if (!Array.isArray(parameters)) return operation
    return {
      ...operation,
      parameters: parameters.map((parameter) =>
        parameter?.name === "location" && parameter?.in === "query"
          ? { ...parameter, style: "deepObject", explode: true }
          : parameter,
      ),
    }
  },
})

export class V2LocationMiddleware extends HttpApiMiddleware.Service<
  V2LocationMiddleware,
  {
    provides:
      | Catalog.Service
      | PluginBoot.Service
      | PermissionV2.Service
      | ProjectReference.Service
      | LocationFileSystem.Service
  }
>()("@opencode/ExperimentalHttpApiV2Location") {}

function ref(request: HttpServerRequest.HttpServerRequest): Location.Ref {
  const query = new URL(request.url, "http://localhost").searchParams
  return {
    directory: AbsolutePath.make(
      query.get("location[directory]") || request.headers["x-opencode-directory"] || process.cwd(),
    ),
    workspaceID: query.get("location[workspace]") || request.headers["x-opencode-workspace"],
  }
}

export const layer = Layer.effect(
  V2LocationMiddleware,
  Effect.gen(function* () {
    const locations = yield* LocationServiceMap
    return V2LocationMiddleware.of((effect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        return yield* effect.pipe(Effect.provide(locations.get(ref(request))))
      }),
    )
  }),
)
