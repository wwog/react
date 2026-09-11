/**
 * Takes a callback of any kind (returns or throws, synchronously or asynchronously) and wraps its result
 * in a Promise.
 *
 * @param callbackFn A function that is called synchronously. It can do anything: either return
 * a value, throw an error, or return a promise.
 * @param args Additional arguments, that will be passed to the callback.
 *
 * @returns A Promise that is:
 * - Already fulfilled, if the callback synchronously returns a value.
 * - Already rejected, if the callback synchronously throws an error.
 * - Asynchronously fulfilled or rejected, if the callback returns a promise.
 */
function promiseTry<T, U extends unknown[]>(
  callbackFn: (...args: U) => T | PromiseLike<T>,
  ...args: U
): Promise<Awaited<T>> {
  try {
    const result = callbackFn(...args) // Call the callback function
    // Check if the result is a PromiseLike (Promise)
    if (result instanceof Promise) {
      return result // If it's a promise, return it directly
    }
    // If the result is not a promise, resolve it with Promise.resolve
    return Promise.resolve(result as Awaited<T>)
  } catch (error) {
    // If the callback throws an error, reject the promise
    return Promise.reject(error)
  }
}

/**
 * `Promise.try` and `Promise.withResolvers` are newer than the lib target many
 * consumers compile against — and this library ships its `src/`, so consumers
 * type-check this file too. Reaching for the native members through an explicit
 * cast keeps the polyfill compiling under any lib, instead of requiring a
 * specific TypeScript version from everyone who imports it.
 */
type PromiseStatics = PromiseConstructor & {
  try?: typeof promiseTry
  withResolvers?: <T>() => {
    promise: Promise<T>
    resolve: (value: T | PromiseLike<T>) => void
    reject: (reason?: unknown) => void
  }
}

export const safePromiseTry = (() => {
  const native = (Promise as PromiseStatics).try
  if (typeof native === 'function') {
    return native.bind(Promise)
  }
  return promiseTry
})()

export const safePromiseWithResolvers = (() => {
  const native = (Promise as PromiseStatics).withResolvers
  if (typeof native === 'function') {
    return native.bind(Promise)
  }
  return <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return {promise, resolve, reject}
  }
})()
