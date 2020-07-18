const PENDING = 'PENDING'; // 等待
const FULFILLED = 'FULFILLED'; // 成功
const REJECTED = 'REJECTED'; // 失败

const resolvePromise = (x, promise2, resolve, reject) => {
  //根据x(返回值)来解析promise2是成功还是失败
  //需要兼容他人的promise

  // If promise and x refer to the same object, reject promise with a TypeError as the reason.
  if (x === promise2) {
    reject(
      new TypeError('TypeError: Chaining cycle detected for promise #<Promise>')
    );
  }

  const isObjectOrFn =
    (typeof x === 'object' && x !== null) || typeof x === 'function';

  if (!isObjectOrFn) {
    resolve(x);
  }

  // x是一个对象或函数
  // if ((typeof x === 'object' && x !== null) || typeof x === 'function') {
  // x如果是promise，可能是别人的promise，可能既调用成功又调用失败
  let called = false;

  try {
    const then = x.then;

    // 没有then方法就当作普通对象，非promise，直接resolve
    if (typeof then !== 'function') {
      resolve(x);
    }

    // 当作是promise，复用上次取到的then
    then.call(
      x,
      (y) => {
        if (called) return;
        called = true;

        // y有可能还是promise，所以要递归解析y的值
        resolvePromise(y, promise2, resolve, reject);
      },
      (r) => {
        if (called) return;
        called = true;

        reject(r);
      }
    );
  } catch (e) {
    // 取then报错就直接reject e
    /** 存在下面的可能：
      let obj = {}
      Object.defineProperty(obj,'then',{
        get(){
          throw new Error('err')
        }
      })
      obj.then
    **/

    if (called) return;
    called = true;

    reject(e);
  }
};

class Promise {
  constructor(executor) {
    this.status = PENDING;
    this.value = undefined;
    this.reason = undefined;
    // 创建成功的队列和失败的队列
    this.onResolvedCallbacks = [];
    this.onRejectedCallbacks = [];

    const resolve = (value) => {
      if (this.status === PENDING) {
        this.status = FULFILLED;
        this.value = value;

        this.onResolvedCallbacks.forEach((fn) => fn());
      }
    };

    const reject = (reason) => {
      if (this.status === PENDING) {
        this.status = REJECTED;
        this.reason = reason;

        this.onRejectedCallbacks.forEach((fn) => fn());
      }
    };

    try {
      executor(resolve, reject); //立即执行
    } catch (err) {
      reject(err);
    }
  }

  then(onFulfilled, onRejected) {
    // 中间的then的函数参数如果没传，就补上函数，实现穿透
    if (typeof onFulfilled !== 'function') {
      onFulfilled = (data) => data;
    }

    if (typeof onRejected !== 'function') {
      onRejected = (err) => {
        throw err;
      };
    }

    // 调用then方法，创建一个新的promise
    const promise2 = new Promise((resolve, reject) => {
      // 根据返回值来判断调用resolve还是reject

      if (this.status === FULFILLED) {
        setTimeout(() => {
          try {
            const x = onFulfilled(this.value);
            resolvePromise(x, promise2, resolve, reject);
          } catch (err) {
            reject(err);
          }
        }, 0);
      }

      if (this.status === REJECTED) {
        setTimeout(() => {
          try {
            const x = onRejected(this.reason);
            resolvePromise(x, promise2, resolve, reject);
          } catch (err) {
            reject(err);
          }
        }, 0);
      }

      // promise内通常有异步操作，所以调then时，executor里的resolve/rejected通常还未执行,
      // 所以此时还是pending状态。就先把onFulfilled和onRejected存入对应队列,多个then里的函数也会存入
      // 等到异步结束resolve/rejected执行时会把对应队列里的函数遍历执行
      if (this.status === PENDING) {
        this.onResolvedCallbacks.push(() => {
          setTimeout(() => {
            try {
              const x = onFulfilled(this.value);
              resolvePromise(x, promise2, resolve, reject);
            } catch (err) {
              reject(err);
            }
          }, 0);
        });

        this.onRejectedCallbacks.push(() => {
          setTimeout(() => {
            try {
              const x = onRejected(this.reason);
              resolvePromise(x, promise2, resolve, reject);
            } catch (err) {
              reject(err);
            }
          }, 0);
        });
      }
    });

    return promise2;
  }
}

// 延迟对象

Promise.defer = Promise.deferred = function () {
  const dfd = {};
  dfd.promise = new Promise((resolve, reject) => {
    dfd.resolve = resolve;
    dfd.reject = reject;
  });

  return dfd;
};

module.exports = Promise;
