import { pipe } from "fp-ts/lib/pipeable"
import * as TE from "fp-ts/lib/TaskEither"
import { MapDataType } from "../../MapData"
import { Dispatcher, DispatcherType } from "../../utils/IDLFlux"
import { getRestTE, liftRestTE  } from "../../utils/RestTaskEither"
import { AppConfig } from "../AppConfig"
import { TopIDL } from "./TopIDL"

function getMapInfoPath(appConfig: AppConfig): string {
    return `${appConfig.mapDir}/${appConfig.mapData}`
}

function getMapFilePath(appConfig: AppConfig, mapFileName: string): string {
    return `${appConfig.mapDir}/${mapFileName}`
}

export const topDispatcher = new Dispatcher<TopIDL>()
    .addAsyncAction("getMapInfo", async (appConfig: AppConfig) => await pipe(
        getRestTE(getMapInfoPath(appConfig), { method: "GET", cache: "no-cache", credentials: "include" }),
        TE.chain(liftRestTE(async (response: Response) => await response.json() as MapDataType))
    )())
    .addAsyncAction("getMap", async (appConfig: AppConfig, fileName: string) => await pipe(
        getRestTE(getMapFilePath(appConfig, fileName), { method: "GET", cache: "no-cache", credentials: "include" }),
        TE.chain(liftRestTE(async (response: Response) => {
            return {
                fileName: fileName,
                blob: await response.blob()    
            }    
        }))                    
    )())
    .addParameterAction("selectMap")

export type TopDispatcherType = DispatcherType<typeof topDispatcher>

