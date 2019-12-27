
import { AppConfig } from "../appConfig"
import { Reducer } from "../utils/reduxUtils"


export type TopActionType = {
    getAppConfig: () => Promise<AppConfig>,
    count: number
}

const initialTopState = {
    appConfig: undefined as AppConfig | undefined
}

export type TopStateType = typeof initialTopState

export const topStateReducer = new Reducer<TopActionType, TopStateType>()
    .case("getAppConfig", (state:typeof initialTopState, appConfig:AppConfig) => {        
        return {
            ...state,
            appConfig: appConfig         
        }
    })
    .build(initialTopState)