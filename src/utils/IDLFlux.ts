import { FilterObject, SelectObject } from "boost-ts"
import { FSA } from "flux-standard-action"
import { Dispatch } from "react"
import { Either, isLeft, isRight } from "fp-ts/lib/Either"
import { IDLType, SuccessOrError, SuccessType, ErrorType } from "./IDL"
import { Unpromise, PromiseUnion } from "./tsUtils"

type DispatchFunctionType<IDL> =
    IDL extends (null | undefined | void | never) ? () => void
        : IDL extends (...args: unknown[]) => Promise<unknown> ? (...args: Parameters<IDL>) => Promise<void>
        : IDL extends (...args: unknown[]) => unknown ? (...args: Parameters<IDL>) => void
        : (value: IDL) => void

type ToEither<T> = T extends (...args:any[])=>Promise<SuccessOrError<unknown, unknown>> ? (...args:Parameters<T>)=>Promise<Either<ErrorType<Unpromise<ReturnType<T>>>, SuccessType<Unpromise<ReturnType<T>>>>> :
    T extends (...args:any[])=>SuccessOrError<unknown, unknown> ? (...args:Parameters<T>)=>Either<ErrorType<ReturnType<T>>, SuccessType<ReturnType<T>>> : T


export class Dispatcher<T extends IDLType, Keys extends keyof T = never> {
    constructor(
        private readonly dispatcher: { [Key in keyof T]: (dispatch: Dispatch<FSA<string>>) => DispatchFunctionType<T[Key]> } = Object.create(null)
    ) {}

    public addAction<Key extends keyof SelectObject<{ [LtdKey in Exclude<keyof T, Keys>]: T[LtdKey] }, null | undefined | void >>(key: Key) {
        return new Dispatcher<T, Keys|Key>({
            ...this.dispatcher,
            [key]: (dispatch: Dispatch<FSA<string>>) => () => dispatch({ type: key as string })
        })
    }

    public addParameterAction<Key extends keyof FilterObject<{ [LtdKey in Exclude<keyof T, Keys>]: T[LtdKey] }, ((...args: any[]) => any) >>(key: Key) {
        return new Dispatcher<T, Keys|Key>({
            ...this.dispatcher,
            [key]: (dispatch: Dispatch<FSA<string>>) => (payload: T[Key]) => dispatch({ type: key as string, payload })
        })
    }

    public addSyncAction<Key extends keyof FilterObject<SelectObject<{ [LtdKey in Exclude<keyof T, Keys>]: T[LtdKey] }, (...args: any[]) => any >, (...args: any[]) => Promise<any> >>(key: Key, func: ToEither<T[Key]>) {
        return new Dispatcher<T, Keys|Key>({
            ...this.dispatcher,
            [key]: (dispatch: Dispatch<FSA<string, unknown>>) => (...args: Parameters<T[Key]>) => {
                const payload = func(...args)
                if (isLeft(payload)) {
                    dispatch({ type: key as string, payload: payload.left, error: true })
                }
                else if (isRight(payload)) {
                    dispatch({ type: key as string, payload: payload.right, error: false })
                }
                else {
                    dispatch({ type: key as string, payload: payload })
                }
            }
        })
    }

    public addAsyncAction<Key extends keyof SelectObject<{ [LtdKey in Exclude<keyof T, Keys>]: T[LtdKey] }, (...args: any[]) => Promise<any>>>(key: Key, func: ToEither<T[Key]>) {
        return new Dispatcher<T, Keys|Key>({
            ...this.dispatcher,
            [key]: (dispatch: Dispatch<FSA<string, unknown>>) => async (...args: Parameters<T[Key]>) => {
                const payload = await func(...args)
                if (isLeft(payload)) {
                    dispatch({ type: key as string, payload: payload.left, error: true })
                }
                else if (isRight(payload)) {
                    dispatch({ type: key as string, payload: payload.right, error: false })
                }
                else {
                    dispatch({ type: key as string, payload: payload })
                }
            }
        })
    }

    public build(dispatch: Dispatch<FSA<string>>): { [Key in Keys]: DispatchFunctionType<T[Key]> } {
        return Object.entries(this.dispatcher).reduce((acc, [key, func]) => {
            return {
                ...acc,
                [key]: func(dispatch)
            }
        }, Object.create(null))
    }
}

export type DispatcherType<D> =  D extends Dispatcher<infer T, infer Keys> ? { [Key in Keys]: DispatchFunctionType<T[Key]> } : never

type ReducerCallbackType<IDL, State> =
    IDL extends (null | undefined | void) ? (state: State, payload?: undefined, error?: boolean, meta?: any) => State
        : IDL extends (...args: unknown[]) => PromiseUnion<SuccessOrError<any, any>> ? (state: State, result: SuccessType<Unpromise<ReturnType<IDL>>>, error?: boolean, meta?: any) => State
        : IDL extends (...args: unknown[]) => unknown ? (state: State, result: Unpromise<ReturnType<IDL>>, error?: boolean, meta?: any) => State
        : (state: State, value: IDL, error?: boolean, meta?: any) => State

type ReducerErrorCallbackType<IDL, State> =
    IDL extends (...args: unknown[]) => PromiseUnion<SuccessOrError<any, any>> ? (state: State, result: ErrorType<Unpromise<ReturnType<IDL>>>, error?: boolean, meta?: any) => State
        : never

type ErrorKeysList<T extends IDLType> = keyof SelectObject<T, (...args:any[])=>PromiseUnion<SuccessOrError<any,any>>>

export class Reducer<T extends IDLType,
        State,
        Keys extends keyof T = never,
        ErrorKeys extends ErrorKeysList<T> = never
> {
    constructor(
        private readonly reducer: { [Key in keyof T]: ReducerCallbackType<T[Key], State> } = Object.create(null),
        private readonly errorReducer: { [Key in keyof T]: ReducerErrorCallbackType<T[Key], State> } = Object.create(null)
    ) {}

    public add<Key extends Exclude<keyof T, Keys>>(
        key: Key,
        callback: ReducerCallbackType<T[Key], State>        
    ) {
        return new Reducer<T, State, Keys|Key, ErrorKeys>({
            ...this.reducer,
            [key]: callback
        }, this.errorReducer)                    
    }

    public addError<ErrorKey extends Exclude<ErrorKeysList<T>, ErrorKeys> & ErrorKeysList<T>> (
        key: ErrorKey,
        errorCallback: ReducerErrorCallbackType<T[ErrorKey], State>
    ) {
        return new Reducer<T, State, Keys, ErrorKeys|ErrorKey>(this.reducer, {
            ...this.errorReducer,    
            [key]: errorCallback
        })
    }

    public build() {
        const reducer = this.reducer
        const errorReducer = this.errorReducer
        return (state: State, action: FSA<string, any>) => {
            const callback = (action.error === true) ? errorReducer[action.type] : reducer[action.type]
            return (callback !== undefined) ? callback(state, action.payload as any, action.error, action.meta) : state            
        }
    }
}
