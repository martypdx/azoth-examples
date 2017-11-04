class ObservableValue {
    constructor(value) {
        this.value = value;
        this.subscribers = null;
    }

    subscribe(subscriber) {
        if(!this.subscribers) {
            this.subscribers = subscriber;
        } 
        else if(Array.isArray(this.subscribers)) {
            this.subscribers.push(subscriber);
        }
        else {
            this.subscribers = [this.subscribers, subscriber];
        }

        subscriber(this.value);

        return {
            unsubscribe: () => {
                this.unsubscribe(subscriber);
            }
        };
    }

    destroy() {
        this.subscribers = null;
    }

    unsubscribe(subscriber) {
        const { subscribers } = this;        
        if(!subscribers) return;
        else if(Array.isArray(subscribers)) {
            const index = subscribers.indexOf(subscriber);
            if(index > -1) subscribers.splice(index, 1);
        }
        else {
            this.subscribers = null;
        }    
    }

    next(value) {
        if(this.value === value) return;
        this.value = value;
        
        const { subscribers } = this;
        if(!subscribers) return;
        else if(Array.isArray(subscribers)) {
            for(let i = 0; i < subscribers.length; i++) {
                subscribers[i](value);
            }
        }
        else {
            subscribers(value);
        }      
    }
}

function removeBlocks(blocks) {
    for(let i = 0; i < blocks.length; i++) {
        const { nodes, unsubscribe, index } = blocks[i];
        if(index) index.destroy();

        if(Array.isArray(nodes)) {
            for(let c = 0; c < nodes.length; c++) nodes[c].remove();
        } 
        else nodes.remove();

        unsubscribe && unsubscribe();
    }
}

function makeOverlay(observable) {
    return new Overlay(observable);
}

class Overlay {
    
    constructor(observable) {
        this._observable = observable;
        this._blocks = [];
    }

    onanchor(anchor) {
        const { _blocks: blocks } = this;
        
        this._observable.subscribe(array => {
            const parent = anchor.parentNode;
            const max = Math.max(blocks.length, array.length);
            for(let i = 0; i < max; i++) {
                const value = array[i];
                const block = blocks[i];
                if(!block) {
                    const observable = new ObservableValue(value); 
                    let fragment = this.map(observable, i);
                    if(typeof fragment === 'function') fragment = fragment();
                    
                    const { childNodes, unsubscribe } = fragment;

                    let nodes = null;
                    if(childNodes.length > 1) {
                        nodes = new Array(childNodes.length);
                        for(let c = 0; c < childNodes.length; c++) nodes[c] = childNodes[c];
                    }
                    else {
                        nodes = childNodes[0];
                    }

                    blocks[i] = { nodes, unsubscribe, observable };
                    parent.insertBefore(fragment, anchor);
                }
                else if(array.length > i) {
                    block.observable.next(value);
                }
                else {
                    const { nodes, unsubscribe, observable } = blocks[i];
                    if(observable) observable.destroy();
            
                    if(Array.isArray(nodes)) {
                        for(let c = 0; c < nodes.length; c++) nodes[c].remove();
                    } 
                    else nodes.remove();
            
                    unsubscribe && unsubscribe();
                }
            }
            blocks.length = array.length;
        });
    }

    unsubscribe() {        
        removeBlocks$1(this._blocks);
    }
}

function removeBlocks$1(blocks) {
    for(let i = 0; i < blocks.length; i++) {
        const { nodes, unsubscribe, observable } = blocks[i];
        if(observable) observable.destroy();

        if(Array.isArray(nodes)) {
            for(let c = 0; c < nodes.length; c++) nodes[c].remove();
        } 
        else nodes.remove();

        unsubscribe && unsubscribe();
    }
}

const makeTemplate = html => {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
};

function renderer(fragment) {

    const nodes = fragment.querySelectorAll('text-node');
    let node = null;
    for(var i = 0; i < nodes.length; node = nodes[++i]) {
        node = nodes[i];
        node.parentNode.replaceChild(document.createTextNode(''), node);
    }

    return function render() {
        const clone = fragment.cloneNode(true);
        return { 
            __fragment: clone, 
            __nodes: clone.querySelectorAll('[data-bind]') 
        };
    };
}

function map(observable, map, subscriber, once = false) {
    let last;
    let lastMapped;
    let any = false;

    const subscription = observable.subscribe(value => {
        if(value !== last) {
            last = value;
            const mapped = map(value);
            if(mapped !== lastMapped) {
                lastMapped = mapped;
                subscriber(mapped);
            }
        }
        if(any && once) subscription.unsubscribe();
        any = true;
    });

    if(any && once) subscription.unsubscribe();
    any = true;

    return subscription;
}

const isProp = (name, node) => name in node;

function attrBinder(node, name) {
    return isProp(name, node)
        ? val => node[name] = val
        : val => node.setAttribute(name, val);
}

function textBinder(node) {
    return val => node.nodeValue = val;
}

function __blockBinder(anchor) {
    const insertBefore = node => anchor.parentNode.insertBefore(node, anchor);

    const top = document.createComment(' block start ');
    insertBefore(top, anchor);
    
    let unsubscribes = null;
    const unsubscribe = () => {
        if(!unsubscribes) return;
        
        if(Array.isArray(unsubscribes)) {
            for(let i = 0; i < unsubscribes.length; i++) {
                const unsub = unsubscribes[i];
                if(unsub.unsubscribe) unsub.unsubscribe();
            }
        } else {
            unsubscribes.unsubscribe && unsubscribes.unsubscribe();
        }
        unsubscribes = null;
    };
    
    const observer = val => {
        removePrior(top, anchor);
        unsubscribe();
        if(!val) return;
        
        const fragment = toFragment(val);

        if(Array.isArray(fragment)) {
            unsubscribes = [];
            let toAppend = null;
            for(let i = 0; i < fragment.length; i++) {
                const f = toFragment(fragment[i]);
                if(!f) continue;

                if(f.unsubscribe) unsubscribes.push(f.unsubscribe);
                
                if(toAppend === null) toAppend = f;
                else toAppend.appendChild(f);
            }
            if(toAppend) insertBefore(toAppend, anchor);
        } else {
            if(!fragment) return;
            unsubscribes = fragment.unsubscribe || null;
            insertBefore(fragment, anchor);
        }
    };

    return { observer, unsubscribe };
}

const toFragment = val => typeof val === 'function' ? val() : val;

const removePrior = (top, anchor) => {
    let sibling = top.nextSibling;
    while(sibling && sibling !== anchor) {
        const current = sibling;
        sibling = sibling.nextSibling;
        current.remove();
    }
};

function propBinder(target, name) {
    return val => target[name] = val;
}

// runtime use:

let objectTypes = {
    'boolean': false,
    'function': true,
    'object': true,
    'number': false,
    'string': false,
    'undefined': false
};
let root = (objectTypes[typeof self] && self) || (objectTypes[typeof window] && window);
let freeGlobal = objectTypes[typeof global] && global;
if (freeGlobal && (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal)) {
    root = freeGlobal;
}
//# sourceMappingURL=root.js.map

function isFunction(x) {
    return typeof x === 'function';
}
//# sourceMappingURL=isFunction.js.map

const isArray = Array.isArray || ((x) => x && typeof x.length === 'number');
//# sourceMappingURL=isArray.js.map

function isObject(x) {
    return x != null && typeof x === 'object';
}
//# sourceMappingURL=isObject.js.map

// typeof any so that it we don't have to cast when comparing a result to the error object
var errorObject = { e: {} };
//# sourceMappingURL=errorObject.js.map

let tryCatchTarget;
function tryCatcher() {
    try {
        return tryCatchTarget.apply(this, arguments);
    }
    catch (e) {
        errorObject.e = e;
        return errorObject;
    }
}
function tryCatch(fn) {
    tryCatchTarget = fn;
    return tryCatcher;
}

//# sourceMappingURL=tryCatch.js.map

/**
 * An error thrown when one or more errors have occurred during the
 * `unsubscribe` of a {@link Subscription}.
 */
class UnsubscriptionError extends Error {
    constructor(errors) {
        super();
        this.errors = errors;
        const err = Error.call(this, errors ?
            `${errors.length} errors occurred during unsubscription:
  ${errors.map((err, i) => `${i + 1}) ${err.toString()}`).join('\n  ')}` : '');
        this.name = err.name = 'UnsubscriptionError';
        this.stack = err.stack;
        this.message = err.message;
    }
}
//# sourceMappingURL=UnsubscriptionError.js.map

class Subscription {
    /**
     * @param {function(): void} [unsubscribe] A function describing how to
     * perform the disposal of resources when the `unsubscribe` method is called.
     */
    constructor(unsubscribe) {
        /**
         * A flag to indicate whether this Subscription has already been unsubscribed.
         * @type {boolean}
         */
        this.closed = false;
        if (unsubscribe) {
            this._unsubscribe = unsubscribe;
        }
    }
    /**
     * Disposes the resources held by the subscription. May, for instance, cancel
     * an ongoing Observable execution or cancel any other type of work that
     * started when the Subscription was created.
     * @return {void}
     */
    unsubscribe() {
        let hasErrors = false;
        let errors;
        if (this.closed) {
            return;
        }
        this.closed = true;
        const { _unsubscribe, _subscriptions } = this;
        this._subscriptions = null;
        if (isFunction(_unsubscribe)) {
            let trial = tryCatch(_unsubscribe).call(this);
            if (trial === errorObject) {
                hasErrors = true;
                (errors = errors || []).push(errorObject.e);
            }
        }
        if (isArray(_subscriptions)) {
            let index = -1;
            const len = _subscriptions.length;
            while (++index < len) {
                const sub = _subscriptions[index];
                if (isObject(sub)) {
                    let trial = tryCatch(sub.unsubscribe).call(sub);
                    if (trial === errorObject) {
                        hasErrors = true;
                        errors = errors || [];
                        let err = errorObject.e;
                        if (err instanceof UnsubscriptionError) {
                            errors = errors.concat(err.errors);
                        }
                        else {
                            errors.push(err);
                        }
                    }
                }
            }
        }
        if (hasErrors) {
            throw new UnsubscriptionError(errors);
        }
    }
    /**
     * Adds a tear down to be called during the unsubscribe() of this
     * Subscription.
     *
     * If the tear down being added is a subscription that is already
     * unsubscribed, is the same reference `add` is being called on, or is
     * `Subscription.EMPTY`, it will not be added.
     *
     * If this subscription is already in an `closed` state, the passed
     * tear down logic will be executed immediately.
     *
     * @param {TeardownLogic} teardown The additional logic to execute on
     * teardown.
     * @return {Subscription} Returns the Subscription used or created to be
     * added to the inner subscriptions list. This Subscription can be used with
     * `remove()` to remove the passed teardown logic from the inner subscriptions
     * list.
     */
    add(teardown) {
        if (!teardown || (teardown === Subscription.EMPTY)) {
            return Subscription.EMPTY;
        }
        if (teardown === this) {
            return this;
        }
        let sub = teardown;
        switch (typeof teardown) {
            case 'function':
                sub = new Subscription(teardown);
            case 'object':
                if (sub.closed || typeof sub.unsubscribe !== 'function') {
                    break;
                }
                else if (this.closed) {
                    sub.unsubscribe();
                }
                else {
                    (this._subscriptions || (this._subscriptions = [])).push(sub);
                }
                break;
            default:
                throw new Error('unrecognized teardown ' + teardown + ' added to Subscription.');
        }
        return sub;
    }
    /**
     * Removes a Subscription from the internal list of subscriptions that will
     * unsubscribe during the unsubscribe process of this Subscription.
     * @param {Subscription} subscription The subscription to remove.
     * @return {void}
     */
    remove(subscription) {
        // HACK: This might be redundant because of the logic in `add()`
        if (subscription == null || (subscription === this) || (subscription === Subscription.EMPTY)) {
            return;
        }
        const subscriptions = this._subscriptions;
        if (subscriptions) {
            const subscriptionIndex = subscriptions.indexOf(subscription);
            if (subscriptionIndex !== -1) {
                subscriptions.splice(subscriptionIndex, 1);
            }
        }
    }
}
Subscription.EMPTY = (function (empty) {
    empty.closed = true;
    return empty;
}(new Subscription()));
//# sourceMappingURL=Subscription.js.map

const empty = {
    closed: true,
    next(value) { },
    error(err) { throw err; },
    complete() { }
};
//# sourceMappingURL=Observer.js.map

const Symbol = root.Symbol;
const $$rxSubscriber = (typeof Symbol === 'function' && typeof Symbol.for === 'function') ?
    Symbol.for('rxSubscriber') : '@@rxSubscriber';
//# sourceMappingURL=rxSubscriber.js.map

class Subscriber extends Subscription {
    /**
     * @param {Observer|function(value: T): void} [destinationOrNext] A partially
     * defined Observer or a `next` callback function.
     * @param {function(e: ?any): void} [error] The `error` callback of an
     * Observer.
     * @param {function(): void} [complete] The `complete` callback of an
     * Observer.
     */
    constructor(destinationOrNext, error, complete) {
        super();
        this.syncErrorValue = null;
        this.syncErrorThrown = false;
        this.syncErrorThrowable = false;
        this.isStopped = false;
        switch (arguments.length) {
            case 0:
                this.destination = empty;
                break;
            case 1:
                if (!destinationOrNext) {
                    this.destination = empty;
                    break;
                }
                if (typeof destinationOrNext === 'object') {
                    if (destinationOrNext instanceof Subscriber) {
                        this.destination = destinationOrNext;
                        this.destination.add(this);
                    }
                    else {
                        this.syncErrorThrowable = true;
                        this.destination = new SafeSubscriber(this, destinationOrNext);
                    }
                    break;
                }
            default:
                this.syncErrorThrowable = true;
                this.destination = new SafeSubscriber(this, destinationOrNext, error, complete);
                break;
        }
    }
    [$$rxSubscriber]() { return this; }
    /**
     * A static factory for a Subscriber, given a (potentially partial) definition
     * of an Observer.
     * @param {function(x: ?T): void} [next] The `next` callback of an Observer.
     * @param {function(e: ?any): void} [error] The `error` callback of an
     * Observer.
     * @param {function(): void} [complete] The `complete` callback of an
     * Observer.
     * @return {Subscriber<T>} A Subscriber wrapping the (partially defined)
     * Observer represented by the given arguments.
     */
    static create(next, error, complete) {
        const subscriber = new Subscriber(next, error, complete);
        subscriber.syncErrorThrowable = false;
        return subscriber;
    }
    /**
     * The {@link Observer} callback to receive notifications of type `next` from
     * the Observable, with a value. The Observable may call this method 0 or more
     * times.
     * @param {T} [value] The `next` value.
     * @return {void}
     */
    next(value) {
        if (!this.isStopped) {
            this._next(value);
        }
    }
    /**
     * The {@link Observer} callback to receive notifications of type `error` from
     * the Observable, with an attached {@link Error}. Notifies the Observer that
     * the Observable has experienced an error condition.
     * @param {any} [err] The `error` exception.
     * @return {void}
     */
    error(err) {
        if (!this.isStopped) {
            this.isStopped = true;
            this._error(err);
        }
    }
    /**
     * The {@link Observer} callback to receive a valueless notification of type
     * `complete` from the Observable. Notifies the Observer that the Observable
     * has finished sending push-based notifications.
     * @return {void}
     */
    complete() {
        if (!this.isStopped) {
            this.isStopped = true;
            this._complete();
        }
    }
    unsubscribe() {
        if (this.closed) {
            return;
        }
        this.isStopped = true;
        super.unsubscribe();
    }
    _next(value) {
        this.destination.next(value);
    }
    _error(err) {
        this.destination.error(err);
        this.unsubscribe();
    }
    _complete() {
        this.destination.complete();
        this.unsubscribe();
    }
}
/**
 * We need this JSDoc comment for affecting ESDoc.
 * @ignore
 * @extends {Ignored}
 */
class SafeSubscriber extends Subscriber {
    constructor(_parent, observerOrNext, error, complete) {
        super();
        this._parent = _parent;
        let next;
        let context = this;
        if (isFunction(observerOrNext)) {
            next = observerOrNext;
        }
        else if (observerOrNext) {
            context = observerOrNext;
            next = observerOrNext.next;
            error = observerOrNext.error;
            complete = observerOrNext.complete;
            if (isFunction(context.unsubscribe)) {
                this.add(context.unsubscribe.bind(context));
            }
            context.unsubscribe = this.unsubscribe.bind(this);
        }
        this._context = context;
        this._next = next;
        this._error = error;
        this._complete = complete;
    }
    next(value) {
        if (!this.isStopped && this._next) {
            const { _parent } = this;
            if (!_parent.syncErrorThrowable) {
                this.__tryOrUnsub(this._next, value);
            }
            else if (this.__tryOrSetError(_parent, this._next, value)) {
                this.unsubscribe();
            }
        }
    }
    error(err) {
        if (!this.isStopped) {
            const { _parent } = this;
            if (this._error) {
                if (!_parent.syncErrorThrowable) {
                    this.__tryOrUnsub(this._error, err);
                    this.unsubscribe();
                }
                else {
                    this.__tryOrSetError(_parent, this._error, err);
                    this.unsubscribe();
                }
            }
            else if (!_parent.syncErrorThrowable) {
                this.unsubscribe();
                throw err;
            }
            else {
                _parent.syncErrorValue = err;
                _parent.syncErrorThrown = true;
                this.unsubscribe();
            }
        }
    }
    complete() {
        if (!this.isStopped) {
            const { _parent } = this;
            if (this._complete) {
                if (!_parent.syncErrorThrowable) {
                    this.__tryOrUnsub(this._complete);
                    this.unsubscribe();
                }
                else {
                    this.__tryOrSetError(_parent, this._complete);
                    this.unsubscribe();
                }
            }
            else {
                this.unsubscribe();
            }
        }
    }
    __tryOrUnsub(fn, value) {
        try {
            fn.call(this._context, value);
        }
        catch (err) {
            this.unsubscribe();
            throw err;
        }
    }
    __tryOrSetError(parent, fn, value) {
        try {
            fn.call(this._context, value);
        }
        catch (err) {
            parent.syncErrorValue = err;
            parent.syncErrorThrown = true;
            return true;
        }
        return false;
    }
    _unsubscribe() {
        const { _parent } = this;
        this._context = null;
        this._parent = null;
        _parent.unsubscribe();
    }
}
//# sourceMappingURL=Subscriber.js.map

function toSubscriber(nextOrObserver, error, complete) {
    if (nextOrObserver) {
        if (nextOrObserver instanceof Subscriber) {
            return nextOrObserver;
        }
        if (nextOrObserver[$$rxSubscriber]) {
            return nextOrObserver[$$rxSubscriber]();
        }
    }
    if (!nextOrObserver && !error && !complete) {
        return new Subscriber();
    }
    return new Subscriber(nextOrObserver, error, complete);
}
//# sourceMappingURL=toSubscriber.js.map

function getSymbolObservable(context) {
    let $$observable;
    let Symbol = context.Symbol;
    if (typeof Symbol === 'function') {
        if (Symbol.observable) {
            $$observable = Symbol.observable;
        }
        else {
            $$observable = Symbol('observable');
            Symbol.observable = $$observable;
        }
    }
    else {
        $$observable = '@@observable';
    }
    return $$observable;
}
const $$observable = getSymbolObservable(root);
//# sourceMappingURL=observable.js.map

class Observable {
    /**
     * @constructor
     * @param {Function} subscribe the function that is  called when the Observable is
     * initially subscribed to. This function is given a Subscriber, to which new values
     * can be `next`ed, or an `error` method can be called to raise an error, or
     * `complete` can be called to notify of a successful completion.
     */
    constructor(subscribe) {
        this._isScalar = false;
        if (subscribe) {
            this._subscribe = subscribe;
        }
    }
    /**
     * Creates a new Observable, with this Observable as the source, and the passed
     * operator defined as the new observable's operator.
     * @method lift
     * @param {Operator} operator the operator defining the operation to take on the observable
     * @return {Observable} a new observable with the Operator applied
     */
    lift(operator) {
        const observable = new Observable();
        observable.source = this;
        observable.operator = operator;
        return observable;
    }
    /**
     * Registers handlers for handling emitted values, error and completions from the observable, and
     *  executes the observable's subscriber function, which will take action to set up the underlying data stream
     * @method subscribe
     * @param {PartialObserver|Function} observerOrNext (optional) either an observer defining all functions to be called,
     *  or the first of three possible handlers, which is the handler for each value emitted from the observable.
     * @param {Function} error (optional) a handler for a terminal event resulting from an error. If no error handler is provided,
     *  the error will be thrown as unhandled
     * @param {Function} complete (optional) a handler for a terminal event resulting from successful completion.
     * @return {ISubscription} a subscription reference to the registered handlers
     */
    subscribe(observerOrNext, error, complete) {
        const { operator } = this;
        const sink = toSubscriber(observerOrNext, error, complete);
        if (operator) {
            operator.call(sink, this);
        }
        else {
            sink.add(this._subscribe(sink));
        }
        if (sink.syncErrorThrowable) {
            sink.syncErrorThrowable = false;
            if (sink.syncErrorThrown) {
                throw sink.syncErrorValue;
            }
        }
        return sink;
    }
    /**
     * @method forEach
     * @param {Function} next a handler for each value emitted by the observable
     * @param {PromiseConstructor} [PromiseCtor] a constructor function used to instantiate the Promise
     * @return {Promise} a promise that either resolves on observable completion or
     *  rejects with the handled error
     */
    forEach(next, PromiseCtor) {
        if (!PromiseCtor) {
            if (root.Rx && root.Rx.config && root.Rx.config.Promise) {
                PromiseCtor = root.Rx.config.Promise;
            }
            else if (root.Promise) {
                PromiseCtor = root.Promise;
            }
        }
        if (!PromiseCtor) {
            throw new Error('no Promise impl found');
        }
        return new PromiseCtor((resolve, reject) => {
            const subscription = this.subscribe((value) => {
                if (subscription) {
                    // if there is a subscription, then we can surmise
                    // the next handling is asynchronous. Any errors thrown
                    // need to be rejected explicitly and unsubscribe must be
                    // called manually
                    try {
                        next(value);
                    }
                    catch (err) {
                        reject(err);
                        subscription.unsubscribe();
                    }
                }
                else {
                    // if there is NO subscription, then we're getting a nexted
                    // value synchronously during subscription. We can just call it.
                    // If it errors, Observable's `subscribe` will ensure the
                    // unsubscription logic is called, then synchronously rethrow the error.
                    // After that, Promise will trap the error and send it
                    // down the rejection path.
                    next(value);
                }
            }, reject, resolve);
        });
    }
    _subscribe(subscriber) {
        return this.source.subscribe(subscriber);
    }
    /**
     * An interop point defined by the es7-observable spec https://github.com/zenparsing/es-observable
     * @method Symbol.observable
     * @return {Observable} this instance of the observable
     */
    [$$observable]() {
        return this;
    }
}
// HACK: Since TypeScript inherits static properties too, we have to
// fight against TypeScript here so Subject can have a different static create signature
/**
 * Creates a new cold Observable by calling the Observable constructor
 * @static true
 * @owner Observable
 * @method create
 * @param {Function} subscribe? the subscriber function to be passed to the Observable constructor
 * @return {Observable} a new cold observable
 */
Observable.create = (subscribe) => {
    return new Observable(subscribe);
};
//# sourceMappingURL=Observable.js.map

function isNodeStyleEventEmmitter(sourceObj) {
    return !!sourceObj && typeof sourceObj.addListener === 'function' && typeof sourceObj.removeListener === 'function';
}
function isJQueryStyleEventEmitter(sourceObj) {
    return !!sourceObj && typeof sourceObj.on === 'function' && typeof sourceObj.off === 'function';
}
function isNodeList(sourceObj) {
    return !!sourceObj && sourceObj.toString() === '[object NodeList]';
}
function isHTMLCollection(sourceObj) {
    return !!sourceObj && sourceObj.toString() === '[object HTMLCollection]';
}
function isEventTarget(sourceObj) {
    return !!sourceObj && typeof sourceObj.addEventListener === 'function' && typeof sourceObj.removeEventListener === 'function';
}
/**
 * We need this JSDoc comment for affecting ESDoc.
 * @extends {Ignored}
 * @hide true
 */
class FromEventObservable extends Observable {
    constructor(sourceObj, eventName, selector, options) {
        super();
        this.sourceObj = sourceObj;
        this.eventName = eventName;
        this.selector = selector;
        this.options = options;
    }
    /* tslint:enable:max-line-length */
    /**
     * Creates an Observable that emits events of a specific type coming from the
     * given event target.
     *
     * <span class="informal">Creates an Observable from DOM events, or Node
     * EventEmitter events or others.</span>
     *
     * <img src="./img/fromEvent.png" width="100%">
     *
     * Creates an Observable by attaching an event listener to an "event target",
     * which may be an object with `addEventListener` and `removeEventListener`,
     * a Node.js EventEmitter, a jQuery style EventEmitter, a NodeList from the
     * DOM, or an HTMLCollection from the DOM. The event handler is attached when
     * the output Observable is subscribed, and removed when the Subscription is
     * unsubscribed.
     *
     * @example <caption>Emits clicks happening on the DOM document</caption>
     * var clicks = Rx.Observable.fromEvent(document, 'click');
     * clicks.subscribe(x => console.log(x));
     *
     * @see {@link from}
     * @see {@link fromEventPattern}
     *
     * @param {EventTargetLike} target The DOMElement, event target, Node.js
     * EventEmitter, NodeList or HTMLCollection to attach the event handler to.
     * @param {string} eventName The event name of interest, being emitted by the
     * `target`.
     * @parm {EventListenerOptions} [options] Options to pass through to addEventListener
     * @param {SelectorMethodSignature<T>} [selector] An optional function to
     * post-process results. It takes the arguments from the event handler and
     * should return a single value.
     * @return {Observable<T>}
     * @static true
     * @name fromEvent
     * @owner Observable
     */
    static create(target, eventName, options, selector) {
        if (isFunction(options)) {
            selector = options;
            options = undefined;
        }
        return new FromEventObservable(target, eventName, selector, options);
    }
    static setupSubscription(sourceObj, eventName, handler, subscriber, options) {
        let unsubscribe;
        if (isNodeList(sourceObj) || isHTMLCollection(sourceObj)) {
            for (let i = 0, len = sourceObj.length; i < len; i++) {
                FromEventObservable.setupSubscription(sourceObj[i], eventName, handler, subscriber, options);
            }
        }
        else if (isEventTarget(sourceObj)) {
            const source = sourceObj;
            sourceObj.addEventListener(eventName, handler, options);
            unsubscribe = () => source.removeEventListener(eventName, handler);
        }
        else if (isJQueryStyleEventEmitter(sourceObj)) {
            const source = sourceObj;
            sourceObj.on(eventName, handler);
            unsubscribe = () => source.off(eventName, handler);
        }
        else if (isNodeStyleEventEmmitter(sourceObj)) {
            const source = sourceObj;
            sourceObj.addListener(eventName, handler);
            unsubscribe = () => source.removeListener(eventName, handler);
        }
        subscriber.add(new Subscription(unsubscribe));
    }
    _subscribe(subscriber) {
        const sourceObj = this.sourceObj;
        const eventName = this.eventName;
        const options = this.options;
        const selector = this.selector;
        let handler = selector ? (...args) => {
            let result = tryCatch(selector)(...args);
            if (result === errorObject) {
                subscriber.error(errorObject.e);
            }
            else {
                subscriber.next(result);
            }
        } : (e) => subscriber.next(e);
        FromEventObservable.setupSubscription(sourceObj, eventName, handler, subscriber, options);
    }
}
//# sourceMappingURL=FromEventObservable.js.map

const fromEvent = FromEventObservable.create;
//# sourceMappingURL=fromEvent.js.map

Observable.fromEvent = fromEvent;
//# sourceMappingURL=fromEvent.js.map

function map$1(project, thisArg) {
    if (typeof project !== 'function') {
        throw new TypeError('argument is not a function. Are you looking for `mapTo()`?');
    }
    return this.lift(new MapOperator(project, thisArg));
}
class MapOperator {
    constructor(project, thisArg) {
        this.project = project;
        this.thisArg = thisArg;
    }
    call(subscriber, source) {
        return source._subscribe(new MapSubscriber(subscriber, this.project, this.thisArg));
    }
}
/**
 * We need this JSDoc comment for affecting ESDoc.
 * @ignore
 * @extends {Ignored}
 */
class MapSubscriber extends Subscriber {
    constructor(destination, project, thisArg) {
        super(destination);
        this.project = project;
        this.count = 0;
        this.thisArg = thisArg || this;
    }
    // NOTE: This looks unoptimized, but it's actually purposefully NOT
    // using try/catch optimizations.
    _next(value) {
        let result;
        try {
            result = this.project.call(this.thisArg, value, this.count++);
        }
        catch (err) {
            this.destination.error(err);
            return;
        }
        this.destination.next(result);
    }
}
//# sourceMappingURL=map.js.map

Observable.prototype.map = map$1;
//# sourceMappingURL=map.js.map

class ScalarObservable extends Observable {
    constructor(value, scheduler) {
        super();
        this.value = value;
        this.scheduler = scheduler;
        this._isScalar = true;
        if (scheduler) {
            this._isScalar = false;
        }
    }
    static create(value, scheduler) {
        return new ScalarObservable(value, scheduler);
    }
    static dispatch(state) {
        const { done, value, subscriber } = state;
        if (done) {
            subscriber.complete();
            return;
        }
        subscriber.next(value);
        if (subscriber.closed) {
            return;
        }
        state.done = true;
        this.schedule(state);
    }
    _subscribe(subscriber) {
        const value = this.value;
        const scheduler = this.scheduler;
        if (scheduler) {
            return scheduler.schedule(ScalarObservable.dispatch, 0, {
                done: false, value, subscriber
            });
        }
        else {
            subscriber.next(value);
            if (!subscriber.closed) {
                subscriber.complete();
            }
        }
    }
}
//# sourceMappingURL=ScalarObservable.js.map

class EmptyObservable extends Observable {
    constructor(scheduler) {
        super();
        this.scheduler = scheduler;
    }
    /**
     * Creates an Observable that emits no items to the Observer and immediately
     * emits a complete notification.
     *
     * <span class="informal">Just emits 'complete', and nothing else.
     * </span>
     *
     * <img src="./img/empty.png" width="100%">
     *
     * This static operator is useful for creating a simple Observable that only
     * emits the complete notification. It can be used for composing with other
     * Observables, such as in a {@link mergeMap}.
     *
     * @example <caption>Emit the number 7, then complete.</caption>
     * var result = Rx.Observable.empty().startWith(7);
     * result.subscribe(x => console.log(x));
     *
     * @example <caption>Map and flatten only odd numbers to the sequence 'a', 'b', 'c'</caption>
     * var interval = Rx.Observable.interval(1000);
     * var result = interval.mergeMap(x =>
     *   x % 2 === 1 ? Rx.Observable.of('a', 'b', 'c') : Rx.Observable.empty()
     * );
     * result.subscribe(x => console.log(x));
     *
     * @see {@link create}
     * @see {@link never}
     * @see {@link of}
     * @see {@link throw}
     *
     * @param {Scheduler} [scheduler] A {@link Scheduler} to use for scheduling
     * the emission of the complete notification.
     * @return {Observable} An "empty" Observable: emits only the complete
     * notification.
     * @static true
     * @name empty
     * @owner Observable
     */
    static create(scheduler) {
        return new EmptyObservable(scheduler);
    }
    static dispatch(arg) {
        const { subscriber } = arg;
        subscriber.complete();
    }
    _subscribe(subscriber) {
        const scheduler = this.scheduler;
        if (scheduler) {
            return scheduler.schedule(EmptyObservable.dispatch, 0, { subscriber });
        }
        else {
            subscriber.complete();
        }
    }
}
//# sourceMappingURL=EmptyObservable.js.map

function isScheduler(value) {
    return value && typeof value.schedule === 'function';
}
//# sourceMappingURL=isScheduler.js.map

class ArrayObservable extends Observable {
    constructor(array, scheduler) {
        super();
        this.array = array;
        this.scheduler = scheduler;
        if (!scheduler && array.length === 1) {
            this._isScalar = true;
            this.value = array[0];
        }
    }
    static create(array, scheduler) {
        return new ArrayObservable(array, scheduler);
    }
    /**
     * Creates an Observable that emits some values you specify as arguments,
     * immediately one after the other, and then emits a complete notification.
     *
     * <span class="informal">Emits the arguments you provide, then completes.
     * </span>
     *
     * <img src="./img/of.png" width="100%">
     *
     * This static operator is useful for creating a simple Observable that only
     * emits the arguments given, and the complete notification thereafter. It can
     * be used for composing with other Observables, such as with {@link concat}.
     * By default, it uses a `null` Scheduler, which means the `next`
     * notifications are sent synchronously, although with a different Scheduler
     * it is possible to determine when those notifications will be delivered.
     *
     * @example <caption>Emit 10, 20, 30, then 'a', 'b', 'c', then start ticking every second.</caption>
     * var numbers = Rx.Observable.of(10, 20, 30);
     * var letters = Rx.Observable.of('a', 'b', 'c');
     * var interval = Rx.Observable.interval(1000);
     * var result = numbers.concat(letters).concat(interval);
     * result.subscribe(x => console.log(x));
     *
     * @see {@link create}
     * @see {@link empty}
     * @see {@link never}
     * @see {@link throw}
     *
     * @param {...T} values Arguments that represent `next` values to be emitted.
     * @param {Scheduler} [scheduler] A {@link Scheduler} to use for scheduling
     * the emissions of the `next` notifications.
     * @return {Observable<T>} An Observable that emits each given input value.
     * @static true
     * @name of
     * @owner Observable
     */
    static of(...array) {
        let scheduler = array[array.length - 1];
        if (isScheduler(scheduler)) {
            array.pop();
        }
        else {
            scheduler = null;
        }
        const len = array.length;
        if (len > 1) {
            return new ArrayObservable(array, scheduler);
        }
        else if (len === 1) {
            return new ScalarObservable(array[0], scheduler);
        }
        else {
            return new EmptyObservable(scheduler);
        }
    }
    static dispatch(state) {
        const { array, index, count, subscriber } = state;
        if (index >= count) {
            subscriber.complete();
            return;
        }
        subscriber.next(array[index]);
        if (subscriber.closed) {
            return;
        }
        state.index = index + 1;
        this.schedule(state);
    }
    _subscribe(subscriber) {
        let index = 0;
        const array = this.array;
        const count = array.length;
        const scheduler = this.scheduler;
        if (scheduler) {
            return scheduler.schedule(ArrayObservable.dispatch, 0, {
                array, index, count, subscriber
            });
        }
        else {
            for (let i = 0; i < count && !subscriber.closed; i++) {
                subscriber.next(array[i]);
            }
            subscriber.complete();
        }
    }
}
//# sourceMappingURL=ArrayObservable.js.map

class OuterSubscriber extends Subscriber {
    notifyNext(outerValue, innerValue, outerIndex, innerIndex, innerSub) {
        this.destination.next(innerValue);
    }
    notifyError(error, innerSub) {
        this.destination.error(error);
    }
    notifyComplete(innerSub) {
        this.destination.complete();
    }
}
//# sourceMappingURL=OuterSubscriber.js.map

function isPromise(value) {
    return value && typeof value.subscribe !== 'function' && typeof value.then === 'function';
}
//# sourceMappingURL=isPromise.js.map

let $$iterator;
const Symbol$1 = root.Symbol;
if (typeof Symbol$1 === 'function') {
    if (Symbol$1.iterator) {
        $$iterator = Symbol$1.iterator;
    }
    else if (typeof Symbol$1.for === 'function') {
        $$iterator = Symbol$1.for('iterator');
    }
}
else {
    if (root.Set && typeof new root.Set()['@@iterator'] === 'function') {
        // Bug for mozilla version
        $$iterator = '@@iterator';
    }
    else if (root.Map) {
        // es6-shim specific logic
        let keys = Object.getOwnPropertyNames(root.Map.prototype);
        for (let i = 0; i < keys.length; ++i) {
            let key = keys[i];
            if (key !== 'entries' && key !== 'size' && root.Map.prototype[key] === root.Map.prototype['entries']) {
                $$iterator = key;
                break;
            }
        }
    }
    else {
        $$iterator = '@@iterator';
    }
}
//# sourceMappingURL=iterator.js.map

class InnerSubscriber extends Subscriber {
    constructor(parent, outerValue, outerIndex) {
        super();
        this.parent = parent;
        this.outerValue = outerValue;
        this.outerIndex = outerIndex;
        this.index = 0;
    }
    _next(value) {
        this.parent.notifyNext(this.outerValue, value, this.outerIndex, this.index++, this);
    }
    _error(error) {
        this.parent.notifyError(error, this);
        this.unsubscribe();
    }
    _complete() {
        this.parent.notifyComplete(this);
        this.unsubscribe();
    }
}
//# sourceMappingURL=InnerSubscriber.js.map

function subscribeToResult(outerSubscriber, result, outerValue, outerIndex) {
    let destination = new InnerSubscriber(outerSubscriber, outerValue, outerIndex);
    if (destination.closed) {
        return null;
    }
    if (result instanceof Observable) {
        if (result._isScalar) {
            destination.next(result.value);
            destination.complete();
            return null;
        }
        else {
            return result.subscribe(destination);
        }
    }
    if (isArray(result)) {
        for (let i = 0, len = result.length; i < len && !destination.closed; i++) {
            destination.next(result[i]);
        }
        if (!destination.closed) {
            destination.complete();
        }
    }
    else if (isPromise(result)) {
        result.then((value) => {
            if (!destination.closed) {
                destination.next(value);
                destination.complete();
            }
        }, (err) => destination.error(err))
            .then(null, (err) => {
            // Escaping the Promise trap: globally throw unhandled errors
            root.setTimeout(() => { throw err; });
        });
        return destination;
    }
    else if (typeof result[$$iterator] === 'function') {
        const iterator = result[$$iterator]();
        do {
            let item = iterator.next();
            if (item.done) {
                destination.complete();
                break;
            }
            destination.next(item.value);
            if (destination.closed) {
                break;
            }
        } while (true);
    }
    else if (typeof result[$$observable] === 'function') {
        const obs = result[$$observable]();
        if (typeof obs.subscribe !== 'function') {
            destination.error(new Error('invalid observable'));
        }
        else {
            return obs.subscribe(new InnerSubscriber(outerSubscriber, outerValue, outerIndex));
        }
    }
    else {
        destination.error(new TypeError('unknown type returned'));
    }
    return null;
}
//# sourceMappingURL=subscribeToResult.js.map

class MergeAllOperator {
    constructor(concurrent) {
        this.concurrent = concurrent;
    }
    call(observer, source) {
        return source._subscribe(new MergeAllSubscriber(observer, this.concurrent));
    }
}
/**
 * We need this JSDoc comment for affecting ESDoc.
 * @ignore
 * @extends {Ignored}
 */
class MergeAllSubscriber extends OuterSubscriber {
    constructor(destination, concurrent) {
        super(destination);
        this.concurrent = concurrent;
        this.hasCompleted = false;
        this.buffer = [];
        this.active = 0;
    }
    _next(observable) {
        if (this.active < this.concurrent) {
            this.active++;
            this.add(subscribeToResult(this, observable));
        }
        else {
            this.buffer.push(observable);
        }
    }
    _complete() {
        this.hasCompleted = true;
        if (this.active === 0 && this.buffer.length === 0) {
            this.destination.complete();
        }
    }
    notifyComplete(innerSub) {
        const buffer = this.buffer;
        this.remove(innerSub);
        this.active--;
        if (buffer.length > 0) {
            this._next(buffer.shift());
        }
        else if (this.active === 0 && this.hasCompleted) {
            this.destination.complete();
        }
    }
}
//# sourceMappingURL=mergeAll.js.map

/* tslint:enable:max-line-length */
/**
 * Creates an output Observable which sequentially emits all values from every
 * given input Observable after the current Observable.
 *
 * <span class="informal">Concatenates multiple Observables together by
 * sequentially emitting their values, one Observable after the other.</span>
 *
 * <img src="./img/concat.png" width="100%">
 *
 * Joins multiple Observables together by subscribing to them one at a time and
 * merging their results into the output Observable. Will wait for each
 * Observable to complete before moving on to the next.
 *
 * @example <caption>Concatenate a timer counting from 0 to 3 with a synchronous sequence from 1 to 10</caption>
 * var timer = Rx.Observable.interval(1000).take(4);
 * var sequence = Rx.Observable.range(1, 10);
 * var result = Rx.Observable.concat(timer, sequence);
 * result.subscribe(x => console.log(x));
 *
 * @example <caption>Concatenate 3 Observables</caption>
 * var timer1 = Rx.Observable.interval(1000).take(10);
 * var timer2 = Rx.Observable.interval(2000).take(6);
 * var timer3 = Rx.Observable.interval(500).take(10);
 * var result = Rx.Observable.concat(timer1, timer2, timer3);
 * result.subscribe(x => console.log(x));
 *
 * @see {@link concatAll}
 * @see {@link concatMap}
 * @see {@link concatMapTo}
 *
 * @param {Observable} input1 An input Observable to concatenate with others.
 * @param {Observable} input2 An input Observable to concatenate with others.
 * More than one input Observables may be given as argument.
 * @param {Scheduler} [scheduler=null] An optional Scheduler to schedule each
 * Observable subscription on.
 * @return {Observable} All values of each passed Observable merged into a
 * single Observable, in order, in serial fashion.
 * @static true
 * @name concat
 * @owner Observable
 */
function concatStatic(...observables) {
    let scheduler = null;
    let args = observables;
    if (isScheduler(args[observables.length - 1])) {
        scheduler = args.pop();
    }
    return new ArrayObservable(observables, scheduler).lift(new MergeAllOperator(1));
}
//# sourceMappingURL=concat.js.map

function startWith(...array) {
    let scheduler = array[array.length - 1];
    if (isScheduler(scheduler)) {
        array.pop();
    }
    else {
        scheduler = null;
    }
    const len = array.length;
    if (len === 1) {
        return concatStatic(new ScalarObservable(array[0], scheduler), this);
    }
    else if (len > 1) {
        return concatStatic(new ArrayObservable(array, scheduler), this);
    }
    else {
        return concatStatic(new EmptyObservable(scheduler), this);
    }
}
//# sourceMappingURL=startWith.js.map

Observable.prototype.startWith = startWith;
//# sourceMappingURL=startWith.js.map

/**
 * An error thrown when an action is invalid because the object has been
 * unsubscribed.
 *
 * @see {@link Subject}
 * @see {@link BehaviorSubject}
 *
 * @class ObjectUnsubscribedError
 */
class ObjectUnsubscribedError extends Error {
    constructor() {
        const err = super('object unsubscribed');
        this.name = err.name = 'ObjectUnsubscribedError';
        this.stack = err.stack;
        this.message = err.message;
    }
}
//# sourceMappingURL=ObjectUnsubscribedError.js.map

class SubjectSubscription extends Subscription {
    constructor(subject, subscriber) {
        super();
        this.subject = subject;
        this.subscriber = subscriber;
        this.closed = false;
    }
    unsubscribe() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        const subject = this.subject;
        const observers = subject.observers;
        this.subject = null;
        if (!observers || observers.length === 0 || subject.isStopped || subject.closed) {
            return;
        }
        const subscriberIndex = observers.indexOf(this.subscriber);
        if (subscriberIndex !== -1) {
            observers.splice(subscriberIndex, 1);
        }
    }
}
//# sourceMappingURL=SubjectSubscription.js.map

class SubjectSubscriber extends Subscriber {
    constructor(destination) {
        super(destination);
        this.destination = destination;
    }
}
/**
 * @class Subject<T>
 */
class Subject extends Observable {
    constructor() {
        super();
        this.observers = [];
        this.closed = false;
        this.isStopped = false;
        this.hasError = false;
        this.thrownError = null;
    }
    [$$rxSubscriber]() {
        return new SubjectSubscriber(this);
    }
    lift(operator) {
        const subject = new AnonymousSubject(this, this);
        subject.operator = operator;
        return subject;
    }
    next(value) {
        if (this.closed) {
            throw new ObjectUnsubscribedError();
        }
        if (!this.isStopped) {
            const { observers } = this;
            const len = observers.length;
            const copy = observers.slice();
            for (let i = 0; i < len; i++) {
                copy[i].next(value);
            }
        }
    }
    error(err) {
        if (this.closed) {
            throw new ObjectUnsubscribedError();
        }
        this.hasError = true;
        this.thrownError = err;
        this.isStopped = true;
        const { observers } = this;
        const len = observers.length;
        const copy = observers.slice();
        for (let i = 0; i < len; i++) {
            copy[i].error(err);
        }
        this.observers.length = 0;
    }
    complete() {
        if (this.closed) {
            throw new ObjectUnsubscribedError();
        }
        this.isStopped = true;
        const { observers } = this;
        const len = observers.length;
        const copy = observers.slice();
        for (let i = 0; i < len; i++) {
            copy[i].complete();
        }
        this.observers.length = 0;
    }
    unsubscribe() {
        this.isStopped = true;
        this.closed = true;
        this.observers = null;
    }
    _subscribe(subscriber) {
        if (this.closed) {
            throw new ObjectUnsubscribedError();
        }
        else if (this.hasError) {
            subscriber.error(this.thrownError);
            return Subscription.EMPTY;
        }
        else if (this.isStopped) {
            subscriber.complete();
            return Subscription.EMPTY;
        }
        else {
            this.observers.push(subscriber);
            return new SubjectSubscription(this, subscriber);
        }
    }
    asObservable() {
        const observable = new Observable();
        observable.source = this;
        return observable;
    }
}
Subject.create = (destination, source) => {
    return new AnonymousSubject(destination, source);
};
/**
 * @class AnonymousSubject<T>
 */
class AnonymousSubject extends Subject {
    constructor(destination, source) {
        super();
        this.destination = destination;
        this.source = source;
    }
    next(value) {
        const { destination } = this;
        if (destination && destination.next) {
            destination.next(value);
        }
    }
    error(err) {
        const { destination } = this;
        if (destination && destination.error) {
            this.destination.error(err);
        }
    }
    complete() {
        const { destination } = this;
        if (destination && destination.complete) {
            this.destination.complete();
        }
    }
    _subscribe(subscriber) {
        const { source } = this;
        if (source) {
            return this.source.subscribe(subscriber);
        }
        else {
            return Subscription.EMPTY;
        }
    }
}
//# sourceMappingURL=Subject.js.map

class BehaviorSubject extends Subject {
    constructor(_value) {
        super();
        this._value = _value;
    }
    get value() {
        return this.getValue();
    }
    _subscribe(subscriber) {
        const subscription = super._subscribe(subscriber);
        if (subscription && !subscription.closed) {
            subscriber.next(this._value);
        }
        return subscription;
    }
    getValue() {
        if (this.hasError) {
            throw this.thrownError;
        }
        else if (this.closed) {
            throw new ObjectUnsubscribedError();
        }
        else {
            return this._value;
        }
    }
    next(value) {
        super.next(this._value = value);
    }
}
//# sourceMappingURL=BehaviorSubject.js.map

const __render0$1 = renderer(makeTemplate(`<p>Things are looking up!</p>`));
const __render1$1 = renderer(makeTemplate(`
        <p>
            Things are going down :(
            <button onclick="confirm('feel better?')">panic</button>
        </p>
    `));
const __render2 = renderer(makeTemplate(`
        <p data-bind>Count is <text-node></text-node></p>
        <div data-bind><!-- block --></div>
        <button onclick="" data-bind>increment</button>
        <button onclick="" data-bind>decrement</button>
    `));
var counter = () => {
  const count = new BehaviorSubject(0);
  const change = x => count.next(count.value + x);
  return counter$1(count, change);
};
const counter$1 = (count, change) => {
  const positive = () => {
    return __render0$1().__fragment;
  };
  const negative = () => {
    return __render1$1().__fragment;
  };
  const {__fragment, __nodes} = __render2();
  const __child0 = __nodes[0].childNodes[1];
  const __child1 = __nodes[1].childNodes[0];
  const __sub0 = count.subscribe(textBinder(__child0));
  const __sub1b = __blockBinder(__child1);
  const __sub1 = map(count, count => count >= 0 ? positive : negative, __sub1b.observer);
  attrBinder(__nodes[2], 'onclick')(() => change(1));
  attrBinder(__nodes[3], 'onclick')(() => change(-1));
  __fragment.unsubscribe = () => {
    __sub0.unsubscribe();
    __sub1.unsubscribe();
    __sub1b.unsubscribe();
  };
  return __fragment;
};

function pluck(...properties) {
    const length = properties.length;
    if (length === 0) {
        throw new Error('list of properties cannot be empty.');
    }
    return map$1.call(this, plucker(properties, length));
}
function plucker(props, length) {
    const mapper = (x) => {
        let currentProp = x;
        for (let i = 0; i < length; i++) {
            const p = currentProp[props[i]];
            if (typeof p !== 'undefined') {
                currentProp = p;
            }
            else {
                return undefined;
            }
        }
        return currentProp;
    };
    return mapper;
}
//# sourceMappingURL=pluck.js.map

Observable.prototype.pluck = pluck;
//# sourceMappingURL=pluck.js.map

const __render0$2 = renderer(makeTemplate(`
    <div class="field">
        <label class="label is-capitalized" data-bind><text-node></text-node>:</label>
        <div class="control">
            <input class="input" value="" onkeyup="" data-bind>
        </div>
    </div>
`));
const __render1$2 = renderer(makeTemplate(`
        <section class="section">
                <p class="is-size-4" data-bind><text-node></text-node> <text-node></text-node>!</p>
                <hr>
                <div class="container" data-bind>
                    <!-- block -->
                    <!-- block -->
                </div>
        </section>
    `));
Observable.prototype.child = Observable.prototype.pluck;
var hello = () => {
  const options = new BehaviorSubject({
    salutation: 'Hello',
    name: 'World'
  });
  const change = value => {
    options.next(Object.assign({}, options.value, value));
  };
  return hello$1(options, change);
};
const TextInput = (prop, val, change) => {
  const {__fragment, __nodes} = __render0$2();
  const __child0 = __nodes[0].childNodes[0];
  textBinder(__child0)(prop);
  attrBinder(__nodes[1], 'value')(val);
  attrBinder(__nodes[1], 'onkeyup')(({target}) => change({
    [prop]: target.value
  }));
  return __fragment;
};
const hello$1 = (__ref0, change) => {
  const name = __ref0.child('name');
  const salutation = __ref0.child('salutation');
  const {__fragment, __nodes} = __render1$2();
  const __child0 = __nodes[0].childNodes[0];
  const __child1 = __nodes[0].childNodes[2];
  const __child2 = __nodes[1].childNodes[1];
  const __child3 = __nodes[1].childNodes[3];
  const __sub0 = salutation.subscribe(textBinder(__child0));
  const __sub1 = name.subscribe(textBinder(__child1));
  const __sub2b = __blockBinder(__child2);
  const __sub2 = map(salutation, salutation => TextInput('salutation', salutation, change), __sub2b.observer, true);
  const __sub3b = __blockBinder(__child3);
  const __sub3 = map(name, name => TextInput('name', name, change), __sub3b.observer, true);
  __fragment.unsubscribe = () => {
    __sub0.unsubscribe();
    __sub1.unsubscribe();
    __sub2.unsubscribe();
    __sub2b.unsubscribe();
    __sub3.unsubscribe();
    __sub3b.unsubscribe();
  };
  return __fragment;
};

class PromiseObservable extends Observable {
    constructor(promise, scheduler) {
        super();
        this.promise = promise;
        this.scheduler = scheduler;
    }
    /**
     * Converts a Promise to an Observable.
     *
     * <span class="informal">Returns an Observable that just emits the Promise's
     * resolved value, then completes.</span>
     *
     * Converts an ES2015 Promise or a Promises/A+ spec compliant Promise to an
     * Observable. If the Promise resolves with a value, the output Observable
     * emits that resolved value as a `next`, and then completes. If the Promise
     * is rejected, then the output Observable emits the corresponding Error.
     *
     * @example <caption>Convert the Promise returned by Fetch to an Observable</caption>
     * var result = Rx.Observable.fromPromise(fetch('http://myserver.com/'));
     * result.subscribe(x => console.log(x), e => console.error(e));
     *
     * @see {@link bindCallback}
     * @see {@link from}
     *
     * @param {Promise<T>} promise The promise to be converted.
     * @param {Scheduler} [scheduler] An optional Scheduler to use for scheduling
     * the delivery of the resolved value (or the rejection).
     * @return {Observable<T>} An Observable which wraps the Promise.
     * @static true
     * @name fromPromise
     * @owner Observable
     */
    static create(promise, scheduler) {
        return new PromiseObservable(promise, scheduler);
    }
    _subscribe(subscriber) {
        const promise = this.promise;
        const scheduler = this.scheduler;
        if (scheduler == null) {
            if (this._isScalar) {
                if (!subscriber.closed) {
                    subscriber.next(this.value);
                    subscriber.complete();
                }
            }
            else {
                promise.then((value) => {
                    this.value = value;
                    this._isScalar = true;
                    if (!subscriber.closed) {
                        subscriber.next(value);
                        subscriber.complete();
                    }
                }, (err) => {
                    if (!subscriber.closed) {
                        subscriber.error(err);
                    }
                })
                    .then(null, err => {
                    // escape the promise trap, throw unhandled errors
                    root.setTimeout(() => { throw err; });
                });
            }
        }
        else {
            if (this._isScalar) {
                if (!subscriber.closed) {
                    return scheduler.schedule(dispatchNext, 0, { value: this.value, subscriber });
                }
            }
            else {
                promise.then((value) => {
                    this.value = value;
                    this._isScalar = true;
                    if (!subscriber.closed) {
                        subscriber.add(scheduler.schedule(dispatchNext, 0, { value, subscriber }));
                    }
                }, (err) => {
                    if (!subscriber.closed) {
                        subscriber.add(scheduler.schedule(dispatchError, 0, { err, subscriber }));
                    }
                })
                    .then(null, (err) => {
                    // escape the promise trap, throw unhandled errors
                    root.setTimeout(() => { throw err; });
                });
            }
        }
    }
}
function dispatchNext(arg) {
    const { value, subscriber } = arg;
    if (!subscriber.closed) {
        subscriber.next(value);
        subscriber.complete();
    }
}
function dispatchError(arg) {
    const { err, subscriber } = arg;
    if (!subscriber.closed) {
        subscriber.error(err);
    }
}
//# sourceMappingURL=PromiseObservable.js.map

class IteratorObservable extends Observable {
    constructor(iterator, scheduler) {
        super();
        this.scheduler = scheduler;
        if (iterator == null) {
            throw new Error('iterator cannot be null.');
        }
        this.iterator = getIterator(iterator);
    }
    static create(iterator, scheduler) {
        return new IteratorObservable(iterator, scheduler);
    }
    static dispatch(state) {
        const { index, hasError, iterator, subscriber } = state;
        if (hasError) {
            subscriber.error(state.error);
            return;
        }
        let result = iterator.next();
        if (result.done) {
            subscriber.complete();
            return;
        }
        subscriber.next(result.value);
        state.index = index + 1;
        if (subscriber.closed) {
            return;
        }
        this.schedule(state);
    }
    _subscribe(subscriber) {
        let index = 0;
        const { iterator, scheduler } = this;
        if (scheduler) {
            return scheduler.schedule(IteratorObservable.dispatch, 0, {
                index, iterator, subscriber
            });
        }
        else {
            do {
                let result = iterator.next();
                if (result.done) {
                    subscriber.complete();
                    break;
                }
                else {
                    subscriber.next(result.value);
                }
                if (subscriber.closed) {
                    break;
                }
            } while (true);
        }
    }
}
class StringIterator {
    constructor(str, idx = 0, len = str.length) {
        this.str = str;
        this.idx = idx;
        this.len = len;
    }
    [$$iterator]() { return (this); }
    next() {
        return this.idx < this.len ? {
            done: false,
            value: this.str.charAt(this.idx++)
        } : {
            done: true,
            value: undefined
        };
    }
}
class ArrayIterator {
    constructor(arr, idx = 0, len = toLength(arr)) {
        this.arr = arr;
        this.idx = idx;
        this.len = len;
    }
    [$$iterator]() { return this; }
    next() {
        return this.idx < this.len ? {
            done: false,
            value: this.arr[this.idx++]
        } : {
            done: true,
            value: undefined
        };
    }
}
function getIterator(obj) {
    const i = obj[$$iterator];
    if (!i && typeof obj === 'string') {
        return new StringIterator(obj);
    }
    if (!i && obj.length !== undefined) {
        return new ArrayIterator(obj);
    }
    if (!i) {
        throw new TypeError('object is not iterable');
    }
    return obj[$$iterator]();
}
const maxSafeInteger = Math.pow(2, 53) - 1;
function toLength(o) {
    let len = +o.length;
    if (isNaN(len)) {
        return 0;
    }
    if (len === 0 || !numberIsFinite(len)) {
        return len;
    }
    len = sign(len) * Math.floor(Math.abs(len));
    if (len <= 0) {
        return 0;
    }
    if (len > maxSafeInteger) {
        return maxSafeInteger;
    }
    return len;
}
function numberIsFinite(value) {
    return typeof value === 'number' && root.isFinite(value);
}
function sign(value) {
    let valueAsNumber = +value;
    if (valueAsNumber === 0) {
        return valueAsNumber;
    }
    if (isNaN(valueAsNumber)) {
        return valueAsNumber;
    }
    return valueAsNumber < 0 ? -1 : 1;
}
//# sourceMappingURL=IteratorObservable.js.map

class ArrayLikeObservable extends Observable {
    constructor(arrayLike, scheduler) {
        super();
        this.arrayLike = arrayLike;
        this.scheduler = scheduler;
        if (!scheduler && arrayLike.length === 1) {
            this._isScalar = true;
            this.value = arrayLike[0];
        }
    }
    static create(arrayLike, scheduler) {
        const length = arrayLike.length;
        if (length === 0) {
            return new EmptyObservable();
        }
        else if (length === 1) {
            return new ScalarObservable(arrayLike[0], scheduler);
        }
        else {
            return new ArrayLikeObservable(arrayLike, scheduler);
        }
    }
    static dispatch(state) {
        const { arrayLike, index, length, subscriber } = state;
        if (subscriber.closed) {
            return;
        }
        if (index >= length) {
            subscriber.complete();
            return;
        }
        subscriber.next(arrayLike[index]);
        state.index = index + 1;
        this.schedule(state);
    }
    _subscribe(subscriber) {
        let index = 0;
        const { arrayLike, scheduler } = this;
        const length = arrayLike.length;
        if (scheduler) {
            return scheduler.schedule(ArrayLikeObservable.dispatch, 0, {
                arrayLike, index, length, subscriber
            });
        }
        else {
            for (let i = 0; i < length && !subscriber.closed; i++) {
                subscriber.next(arrayLike[i]);
            }
            subscriber.complete();
        }
    }
}
//# sourceMappingURL=ArrayLikeObservable.js.map

class Notification {
    constructor(kind, value, exception) {
        this.kind = kind;
        this.value = value;
        this.exception = exception;
        this.hasValue = kind === 'N';
    }
    /**
     * Delivers to the given `observer` the value wrapped by this Notification.
     * @param {Observer} observer
     * @return
     */
    observe(observer) {
        switch (this.kind) {
            case 'N':
                return observer.next && observer.next(this.value);
            case 'E':
                return observer.error && observer.error(this.exception);
            case 'C':
                return observer.complete && observer.complete();
        }
    }
    /**
     * Given some {@link Observer} callbacks, deliver the value represented by the
     * current Notification to the correctly corresponding callback.
     * @param {function(value: T): void} next An Observer `next` callback.
     * @param {function(err: any): void} [error] An Observer `error` callback.
     * @param {function(): void} [complete] An Observer `complete` callback.
     * @return {any}
     */
    do(next, error, complete) {
        const kind = this.kind;
        switch (kind) {
            case 'N':
                return next && next(this.value);
            case 'E':
                return error && error(this.exception);
            case 'C':
                return complete && complete();
        }
    }
    /**
     * Takes an Observer or its individual callback functions, and calls `observe`
     * or `do` methods accordingly.
     * @param {Observer|function(value: T): void} nextOrObserver An Observer or
     * the `next` callback.
     * @param {function(err: any): void} [error] An Observer `error` callback.
     * @param {function(): void} [complete] An Observer `complete` callback.
     * @return {any}
     */
    accept(nextOrObserver, error, complete) {
        if (nextOrObserver && typeof nextOrObserver.next === 'function') {
            return this.observe(nextOrObserver);
        }
        else {
            return this.do(nextOrObserver, error, complete);
        }
    }
    /**
     * Returns a simple Observable that just delivers the notification represented
     * by this Notification instance.
     * @return {any}
     */
    toObservable() {
        const kind = this.kind;
        switch (kind) {
            case 'N':
                return Observable.of(this.value);
            case 'E':
                return Observable.throw(this.exception);
            case 'C':
                return Observable.empty();
        }
        throw new Error('unexpected notification kind value');
    }
    /**
     * A shortcut to create a Notification instance of the type `next` from a
     * given value.
     * @param {T} value The `next` value.
     * @return {Notification<T>} The "next" Notification representing the
     * argument.
     */
    static createNext(value) {
        if (typeof value !== 'undefined') {
            return new Notification('N', value);
        }
        return this.undefinedValueNotification;
    }
    /**
     * A shortcut to create a Notification instance of the type `error` from a
     * given error.
     * @param {any} [err] The `error` exception.
     * @return {Notification<T>} The "error" Notification representing the
     * argument.
     */
    static createError(err) {
        return new Notification('E', undefined, err);
    }
    /**
     * A shortcut to create a Notification instance of the type `complete`.
     * @return {Notification<any>} The valueless "complete" Notification.
     */
    static createComplete() {
        return this.completeNotification;
    }
}
Notification.completeNotification = new Notification('C');
Notification.undefinedValueNotification = new Notification('N', undefined);
//# sourceMappingURL=Notification.js.map

/**
 * We need this JSDoc comment for affecting ESDoc.
 * @ignore
 * @extends {Ignored}
 */
class ObserveOnSubscriber extends Subscriber {
    constructor(destination, scheduler, delay = 0) {
        super(destination);
        this.scheduler = scheduler;
        this.delay = delay;
    }
    static dispatch(arg) {
        const { notification, destination } = arg;
        notification.observe(destination);
    }
    scheduleMessage(notification) {
        this.add(this.scheduler.schedule(ObserveOnSubscriber.dispatch, this.delay, new ObserveOnMessage(notification, this.destination)));
    }
    _next(value) {
        this.scheduleMessage(Notification.createNext(value));
    }
    _error(err) {
        this.scheduleMessage(Notification.createError(err));
    }
    _complete() {
        this.scheduleMessage(Notification.createComplete());
    }
}
class ObserveOnMessage {
    constructor(notification, destination) {
        this.notification = notification;
        this.destination = destination;
    }
}
//# sourceMappingURL=observeOn.js.map

const isArrayLike = ((x) => x && typeof x.length === 'number');
/**
 * We need this JSDoc comment for affecting ESDoc.
 * @extends {Ignored}
 * @hide true
 */
class FromObservable extends Observable {
    constructor(ish, scheduler) {
        super(null);
        this.ish = ish;
        this.scheduler = scheduler;
    }
    /**
     * Creates an Observable from an Array, an array-like object, a Promise, an
     * iterable object, or an Observable-like object.
     *
     * <span class="informal">Converts almost anything to an Observable.</span>
     *
     * <img src="./img/from.png" width="100%">
     *
     * Convert various other objects and data types into Observables. `from`
     * converts a Promise or an array-like or an
     * [iterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#iterable)
     * object into an Observable that emits the items in that promise or array or
     * iterable. A String, in this context, is treated as an array of characters.
     * Observable-like objects (contains a function named with the ES2015 Symbol
     * for Observable) can also be converted through this operator.
     *
     * @example <caption>Converts an array to an Observable</caption>
     * var array = [10, 20, 30];
     * var result = Rx.Observable.from(array);
     * result.subscribe(x => console.log(x));
     *
     * @example <caption>Convert an infinite iterable (from a generator) to an Observable</caption>
     * function* generateDoubles(seed) {
     *   var i = seed;
     *   while (true) {
     *     yield i;
     *     i = 2 * i; // double it
     *   }
     * }
     *
     * var iterator = generateDoubles(3);
     * var result = Rx.Observable.from(iterator).take(10);
     * result.subscribe(x => console.log(x));
     *
     * @see {@link create}
     * @see {@link fromEvent}
     * @see {@link fromEventPattern}
     * @see {@link fromPromise}
     *
     * @param {ObservableInput<T>} ish A subscribable object, a Promise, an
     * Observable-like, an Array, an iterable or an array-like object to be
     * converted.
     * @param {Scheduler} [scheduler] The scheduler on which to schedule the
     * emissions of values.
     * @return {Observable<T>} The Observable whose values are originally from the
     * input object that was converted.
     * @static true
     * @name from
     * @owner Observable
     */
    static create(ish, scheduler) {
        if (ish != null) {
            if (typeof ish[$$observable] === 'function') {
                if (ish instanceof Observable && !scheduler) {
                    return ish;
                }
                return new FromObservable(ish, scheduler);
            }
            else if (isArray(ish)) {
                return new ArrayObservable(ish, scheduler);
            }
            else if (isPromise(ish)) {
                return new PromiseObservable(ish, scheduler);
            }
            else if (typeof ish[$$iterator] === 'function' || typeof ish === 'string') {
                return new IteratorObservable(ish, scheduler);
            }
            else if (isArrayLike(ish)) {
                return new ArrayLikeObservable(ish, scheduler);
            }
        }
        throw new TypeError((ish !== null && typeof ish || ish) + ' is not observable');
    }
    _subscribe(subscriber) {
        const ish = this.ish;
        const scheduler = this.scheduler;
        if (scheduler == null) {
            return ish[$$observable]().subscribe(subscriber);
        }
        else {
            return ish[$$observable]().subscribe(new ObserveOnSubscriber(subscriber, scheduler, 0));
        }
    }
}
//# sourceMappingURL=FromObservable.js.map

const from = FromObservable.create;
//# sourceMappingURL=from.js.map

Observable.from = from;
//# sourceMappingURL=from.js.map

const __render0$3 = renderer(makeTemplate(`
    <div class="card">
        <a href="" target="_blank" data-bind><text-node></text-node></a>
        🌟<strong data-bind><text-node></text-node></strong>
        <p data-bind><text-node></text-node></p>
    </div>
`));
const __render1$3 = renderer(makeTemplate(`
    <h3 class="text-center" data-bind>Found <text-node></text-node></h3>
    <div class="list" data-bind>
        <!-- block -->
    </div>      
`));
const SEARCH = 'https://api.github.com/search/repositories';
const double = 4;
var ghRepo = () => {
  const req = fetch(`${SEARCH}?q=stars:>5000&sort=stars&per_page=100`).then(r => r.json()).then(r => {
    let items = r.items;
    for (let i = 0; i < double; i++) {
      items = items.concat(items);
    }
    return items;
  });
  return repos(Observable.from(req));
};
const repo = ({html_url: url, full_name: name, stargazers_count: stars, description}) => {
  const {__fragment, __nodes} = __render0$3();
  const __child1 = __nodes[0].childNodes[0];
  const __child2 = __nodes[1].childNodes[0];
  const __child3 = __nodes[2].childNodes[0];
  attrBinder(__nodes[0], 'href')(url);
  textBinder(__child1)(name);
  textBinder(__child2)(stars);
  textBinder(__child3)(description);
  return __fragment;
};
const repos = repos => {
  const {__fragment, __nodes} = __render1$3();
  const __child0 = __nodes[0].childNodes[1];
  const __child1 = __nodes[1].childNodes[1];
  const __sub0 = map(repos, repos => repos.length, textBinder(__child0), true);
  const __sub1b = __blockBinder(__child1);
  const __sub1 = map(repos, repos => (() => {
    console.time('render ' + repos.length);
    const fragments = repos.map(repo);
    console.timeEnd('render ' + repos.length);
    return fragments;
  })(), __sub1b.observer, true);
  __fragment.unsubscribe = () => {
    __sub0.unsubscribe();
    __sub1.unsubscribe();
    __sub1b.unsubscribe();
  };
  return __fragment;
};

const __render0$4 = renderer(makeTemplate(`
    <h3 class="text-center">Show HN</h3>
    <h2 data-bind><text-node></text-node> stories</h2>
    <ul data-bind>
        <!-- block -->
    </ul>       
`));
const __render1$4 = renderer(makeTemplate(`
        <!-- block -->
    `));
const __render2$1 = renderer(makeTemplate(`
    <p data-bind><text-node></text-node> by <em data-bind><text-node></text-node></em></p>
`));
const __render3 = renderer(makeTemplate(`
    <div data-bind>
        <div data-bind><text-node></text-node></div>
        <!-- block -->
    </div>
`));
const __render4 = renderer(makeTemplate(`'comments'`));
const __render5 = renderer(makeTemplate(`
    <li>
        <div class="card" data-bind>
            <a href="" target="_blank" data-bind><text-node></text-node></a>
            🌟<strong data-bind><text-node></text-node></strong>
            <!-- block -->
            <text-node></text-node> comments
            <ul data-bind>
            <!-- block -->
            </ul>
        </div>
    </li>
`));
var config = {
  databaseURL: 'https://hacker-news.firebaseio.com'
};
firebase.initializeApp(config);
const fb = firebase.database().ref('v0');
Object.getPrototypeOf(fb).subscribe = function subscribe(listener) {
  const fn = snapshot => void listener(snapshot.val());
  this.on('value', fn);
  return {
    unsubscribe: () => void this.off('value', fn)
  };
};
var showHN = () => {
  const type = 'top';
  return Show(fb.child(`${type}stories`));
};
const Show = topics => {
  const {__fragment, __nodes} = __render0$4();
  const __child0 = __nodes[0].childNodes[0];
  const __child1 = __nodes[1].childNodes[1];
  const __sub0 = map(topics, topics => topics.length, textBinder(__child0));
  const __sub1b = __blockBinder(__child1);
  const __sub1 = map(topics, topics => (() => {
    console.log('topics', topics.length);
    console.time('shn render');
    const mapped = topics.map(key => story(key));
    console.timeEnd('shn render');
    return mapped;
  })(), __sub1b.observer, true);
  __fragment.unsubscribe = () => {
    __sub0.unsubscribe();
    __sub1.unsubscribe();
    __sub1b.unsubscribe();
  };
  return __fragment;
};
const items = fb.child('item');
const story = key => {
  const ref = items.child(key);
  return Card(ref);
};
const Byline = ({type, by}) => {
  const {__fragment, __nodes} = __render2$1();
  const __child0 = __nodes[0].childNodes[0];
  const __child1 = __nodes[1].childNodes[0];
  textBinder(__child0)(type);
  textBinder(__child1)(by);
  return __fragment;
};
const Card = item => {
  const {__fragment, __nodes} = __render5();
  const __child0 = __nodes[0].childNodes[5];
  const __child1 = __nodes[0].childNodes[7];
  const __child3 = __nodes[1].childNodes[0];
  const __child4 = __nodes[2].childNodes[0];
  const __child5 = __nodes[3].childNodes[1];
  const __sub0b = __blockBinder(__child0);
  const __sub0 = map(item, item => Byline(item), __sub0b.observer, true);
  const __sub1 = map(item, item => item.kids ? item.kids.length : 0, textBinder(__child1), true);
  const __sub2 = map(item, item => item.url, attrBinder(__nodes[1], 'href'), true);
  const __sub3 = map(item, item => item.title, textBinder(__child3), true);
  const __sub4 = map(item, item => item.score, textBinder(__child4), true);
  const __sub5b = __blockBinder(__child5);
  __sub5b.observer(() => {
    return __render4().__fragment;
  });
  __fragment.unsubscribe = () => {
    __sub0.unsubscribe();
    __sub0b.unsubscribe();
    __sub1.unsubscribe();
    __sub2.unsubscribe();
    __sub3.unsubscribe();
    __sub4.unsubscribe();
    __sub5b.unsubscribe();
  };
  return __fragment;
};

function _do(nextOrObserver, error, complete) {
    return this.lift(new DoOperator(nextOrObserver, error, complete));
}
class DoOperator {
    constructor(nextOrObserver, error, complete) {
        this.nextOrObserver = nextOrObserver;
        this.error = error;
        this.complete = complete;
    }
    call(subscriber, source) {
        return source._subscribe(new DoSubscriber(subscriber, this.nextOrObserver, this.error, this.complete));
    }
}
/**
 * We need this JSDoc comment for affecting ESDoc.
 * @ignore
 * @extends {Ignored}
 */
class DoSubscriber extends Subscriber {
    constructor(destination, nextOrObserver, error, complete) {
        super(destination);
        const safeSubscriber = new Subscriber(nextOrObserver, error, complete);
        safeSubscriber.syncErrorThrowable = true;
        this.add(safeSubscriber);
        this.safeSubscriber = safeSubscriber;
    }
    _next(value) {
        const { safeSubscriber } = this;
        safeSubscriber.next(value);
        if (safeSubscriber.syncErrorThrown) {
            this.destination.error(safeSubscriber.syncErrorValue);
        }
        else {
            this.destination.next(value);
        }
    }
    _error(err) {
        const { safeSubscriber } = this;
        safeSubscriber.error(err);
        if (safeSubscriber.syncErrorThrown) {
            this.destination.error(safeSubscriber.syncErrorValue);
        }
        else {
            this.destination.error(err);
        }
    }
    _complete() {
        const { safeSubscriber } = this;
        safeSubscriber.complete();
        if (safeSubscriber.syncErrorThrown) {
            this.destination.error(safeSubscriber.syncErrorValue);
        }
        else {
            this.destination.complete();
        }
    }
}
//# sourceMappingURL=do.js.map

Observable.prototype.do = _do;
Observable.prototype._do = _do;
//# sourceMappingURL=do.js.map

function mergeMap(project, resultSelector, concurrent = Number.POSITIVE_INFINITY) {
    if (typeof resultSelector === 'number') {
        concurrent = resultSelector;
        resultSelector = null;
    }
    return this.lift(new MergeMapOperator(project, resultSelector, concurrent));
}
class MergeMapOperator {
    constructor(project, resultSelector, concurrent = Number.POSITIVE_INFINITY) {
        this.project = project;
        this.resultSelector = resultSelector;
        this.concurrent = concurrent;
    }
    call(observer, source) {
        return source._subscribe(new MergeMapSubscriber(observer, this.project, this.resultSelector, this.concurrent));
    }
}
/**
 * We need this JSDoc comment for affecting ESDoc.
 * @ignore
 * @extends {Ignored}
 */
class MergeMapSubscriber extends OuterSubscriber {
    constructor(destination, project, resultSelector, concurrent = Number.POSITIVE_INFINITY) {
        super(destination);
        this.project = project;
        this.resultSelector = resultSelector;
        this.concurrent = concurrent;
        this.hasCompleted = false;
        this.buffer = [];
        this.active = 0;
        this.index = 0;
    }
    _next(value) {
        if (this.active < this.concurrent) {
            this._tryNext(value);
        }
        else {
            this.buffer.push(value);
        }
    }
    _tryNext(value) {
        let result;
        const index = this.index++;
        try {
            result = this.project(value, index);
        }
        catch (err) {
            this.destination.error(err);
            return;
        }
        this.active++;
        this._innerSub(result, value, index);
    }
    _innerSub(ish, value, index) {
        this.add(subscribeToResult(this, ish, value, index));
    }
    _complete() {
        this.hasCompleted = true;
        if (this.active === 0 && this.buffer.length === 0) {
            this.destination.complete();
        }
    }
    notifyNext(outerValue, innerValue, outerIndex, innerIndex, innerSub) {
        if (this.resultSelector) {
            this._notifyResultSelector(outerValue, innerValue, outerIndex, innerIndex);
        }
        else {
            this.destination.next(innerValue);
        }
    }
    _notifyResultSelector(outerValue, innerValue, outerIndex, innerIndex) {
        let result;
        try {
            result = this.resultSelector(outerValue, innerValue, outerIndex, innerIndex);
        }
        catch (err) {
            this.destination.error(err);
            return;
        }
        this.destination.next(result);
    }
    notifyComplete(innerSub) {
        const buffer = this.buffer;
        this.remove(innerSub);
        this.active--;
        if (buffer.length > 0) {
            this._next(buffer.shift());
        }
        else if (this.active === 0 && this.hasCompleted) {
            this.destination.complete();
        }
    }
}
//# sourceMappingURL=mergeMap.js.map

Observable.prototype.mergeMap = mergeMap;
Observable.prototype.flatMap = mergeMap;
//# sourceMappingURL=mergeMap.js.map

class ConnectableObservable extends Observable {
    constructor(source, subjectFactory) {
        super();
        this.source = source;
        this.subjectFactory = subjectFactory;
        this._refCount = 0;
    }
    _subscribe(subscriber) {
        return this.getSubject().subscribe(subscriber);
    }
    getSubject() {
        const subject = this._subject;
        if (!subject || subject.isStopped) {
            this._subject = this.subjectFactory();
        }
        return this._subject;
    }
    connect() {
        let connection = this._connection;
        if (!connection) {
            connection = this._connection = new Subscription();
            connection.add(this.source
                .subscribe(new ConnectableSubscriber(this.getSubject(), this)));
            if (connection.closed) {
                this._connection = null;
                connection = Subscription.EMPTY;
            }
            else {
                this._connection = connection;
            }
        }
        return connection;
    }
    refCount() {
        return this.lift(new RefCountOperator(this));
    }
}
class ConnectableSubscriber extends SubjectSubscriber {
    constructor(destination, connectable) {
        super(destination);
        this.connectable = connectable;
    }
    _error(err) {
        this._unsubscribe();
        super._error(err);
    }
    _complete() {
        this._unsubscribe();
        super._complete();
    }
    _unsubscribe() {
        const { connectable } = this;
        if (connectable) {
            this.connectable = null;
            const connection = connectable._connection;
            connectable._refCount = 0;
            connectable._subject = null;
            connectable._connection = null;
            if (connection) {
                connection.unsubscribe();
            }
        }
    }
}
class RefCountOperator {
    constructor(connectable) {
        this.connectable = connectable;
    }
    call(subscriber, source) {
        const { connectable } = this;
        connectable._refCount++;
        const refCounter = new RefCountSubscriber(subscriber, connectable);
        const subscription = source._subscribe(refCounter);
        if (!refCounter.closed) {
            refCounter.connection = connectable.connect();
        }
        return subscription;
    }
}
class RefCountSubscriber extends Subscriber {
    constructor(destination, connectable) {
        super(destination);
        this.connectable = connectable;
    }
    _unsubscribe() {
        const { connectable } = this;
        if (!connectable) {
            this.connection = null;
            return;
        }
        this.connectable = null;
        const refCount = connectable._refCount;
        if (refCount <= 0) {
            this.connection = null;
            return;
        }
        connectable._refCount = refCount - 1;
        if (refCount > 1) {
            this.connection = null;
            return;
        }
        ///
        // Compare the local RefCountSubscriber's connection Subscription to the
        // connection Subscription on the shared ConnectableObservable. In cases
        // where the ConnectableObservable source synchronously emits values, and
        // the RefCountSubscriber's dowstream Observers synchronously unsubscribe,
        // execution continues to here before the RefCountOperator has a chance to
        // supply the RefCountSubscriber with the shared connection Subscription.
        // For example:
        // ```
        // Observable.range(0, 10)
        //   .publish()
        //   .refCount()
        //   .take(5)
        //   .subscribe();
        // ```
        // In order to account for this case, RefCountSubscriber should only dispose
        // the ConnectableObservable's shared connection Subscription if the
        // connection Subscription exists, *and* either:
        //   a. RefCountSubscriber doesn't have a reference to the shared connection
        //      Subscription yet, or,
        //   b. RefCountSubscriber's connection Subscription reference is identical
        //      to the shared connection Subscription
        ///
        const { connection } = this;
        const sharedConnection = connectable._connection;
        this.connection = null;
        if (sharedConnection && (!connection || sharedConnection === connection)) {
            sharedConnection.unsubscribe();
        }
    }
}
//# sourceMappingURL=ConnectableObservable.js.map

class MulticastObservable extends Observable {
    constructor(source, subjectFactory, selector) {
        super();
        this.source = source;
        this.subjectFactory = subjectFactory;
        this.selector = selector;
    }
    _subscribe(subscriber) {
        const { selector, source } = this;
        const connectable = new ConnectableObservable(source, this.subjectFactory);
        const subscription = selector(connectable).subscribe(subscriber);
        subscription.add(connectable.connect());
        return subscription;
    }
}
//# sourceMappingURL=MulticastObservable.js.map

function multicast(subjectOrSubjectFactory, selector) {
    let subjectFactory;
    if (typeof subjectOrSubjectFactory === 'function') {
        subjectFactory = subjectOrSubjectFactory;
    }
    else {
        subjectFactory = function subjectFactory() {
            return subjectOrSubjectFactory;
        };
    }
    return !selector ?
        new ConnectableObservable(this, subjectFactory) :
        new MulticastObservable(this, subjectFactory, selector);
}
//# sourceMappingURL=multicast.js.map

function shareSubjectFactory() {
    return new Subject();
}
/**
 * Returns a new Observable that multicasts (shares) the original Observable. As long as there is at least one
 * Subscriber this Observable will be subscribed and emitting data. When all subscribers have unsubscribed it will
 * unsubscribe from the source Observable. Because the Observable is multicasting it makes the stream `hot`.
 * This is an alias for .publish().refCount().
 *
 * <img src="./img/share.png" width="100%">
 *
 * @return {Observable<T>} an Observable that upon connection causes the source Observable to emit items to its Observers
 * @method share
 * @owner Observable
 */
function share() {
    return multicast.call(this, shareSubjectFactory).refCount();
}

//# sourceMappingURL=share.js.map

Observable.prototype.share = share;
//# sourceMappingURL=share.js.map

const __render0$5 = renderer(makeTemplate(`
        <header>
            <h3 class="text-center" data-bind><text-node></text-node> Records - Page <text-node></text-node> of <text-node></text-node></h3>
        </header>
        <section style="position:relative;" data-bind>
            <!-- block -->
            <!-- block -->
        </section>
        <footer data-bind>
            <!-- block -->
        </footer>
    `));
const __render1$5 = renderer(makeTemplate(`
        <button disabled="" onclick="" data-bind><text-node></text-node></button>
    `));
const __render2$2 = renderer(makeTemplate(`
        <span data-bind>
            <!-- block -->
            <!-- block -->
        </span>
    `));
const __render3$1 = renderer(makeTemplate(`
    <div class="fill" style="height: 100%; text-align: center;">
        <img style="height: 100%;" src="https://www.createwebsite.net/wp-content/uploads/2015/09/GD.gif">
    </div>
`));
const __render4$1 = renderer(makeTemplate(`
            <tr>
                <td data-bind><text-node></text-node></td>
                <td data-bind><text-node></text-node></td>
                <td data-bind><text-node></text-node></td>
                <td data-bind><text-node></text-node></td>
                <td data-bind><text-node></text-node></td>
                <td data-bind><text-node></text-node></td>
            </tr>`));
const __render5$1 = renderer(makeTemplate(`
    <table class="table is-striped is-hoverable is-fullwidth" data-bind>
        <thead>
            <tr>
                <th>name</th>
                <th>birth year</th>
                <th>eye color</th>
                <th>hair color</th>
                <th>height</th>
                <th>mass</th>
            </tr>
        </thead>
        <!-- component start --><!-- component end -->
    </table>
`));
const API = 'https://swapi.co/api/people/';
const PER_PAGE = 10;
const getPageNumber = url => {
  const search = url.split('?')[1];
  return search && new URLSearchParams(search).get('page') || '1';
};
const fetchPage = url => fetch(url).then(r => r.json()).then(r => (r.pageNumber = getPageNumber(url), r));
var starWars = () => {
  const url = new Subject();
  const loading = new Subject();
  const cache = new Map();
  const page = url.startWith(`${API}?page=1`).do(() => loading.next(true)).do(url => cache.has(url) || cache.set(url, fetchPage(url))).mergeMap(url => cache.get(url)).do(() => loading.next(false)).share();
  const paging = PagingButtons(page, url);
  return Viewer(page, loading.startWith(true), paging);
};
const Viewer = (__ref0, loading, Paging) => {
  const count = __ref0.child('count');
  const pageNumber = __ref0.child('pageNumber');
  const results = __ref0.child('results');
  const {__fragment, __nodes} = __render0$5();
  const __child0 = __nodes[0].childNodes[0];
  const __child1 = __nodes[0].childNodes[2];
  const __child2 = __nodes[0].childNodes[4];
  const __child3 = __nodes[1].childNodes[1];
  const __child4 = __nodes[1].childNodes[3];
  const __child5 = __nodes[2].childNodes[1];
  const __sub0 = count.subscribe(textBinder(__child0));
  const __sub1 = pageNumber.subscribe(textBinder(__child1));
  const __sub2 = map(count, count => Math.ceil(count / PER_PAGE), textBinder(__child2));
  const __sub3b = __blockBinder(__child3);
  const __sub3 = map(loading, loading => loading && Spinner, __sub3b.observer);
  const __sub4b = __blockBinder(__child4);
  __sub4b.observer(people(results));
  const __sub5b = __blockBinder(__child5);
  __sub5b.observer(Paging);
  __fragment.unsubscribe = () => {
    __sub0.unsubscribe();
    __sub1.unsubscribe();
    __sub2.unsubscribe();
    __sub3.unsubscribe();
    __sub3b.unsubscribe();
    __sub4b.unsubscribe();
    __sub5b.unsubscribe();
  };
  return __fragment;
};
const PagingButtons = (__ref1, setUrl) => {
  const previous = __ref1.child('previous');
  const next = __ref1.child('next');
  const Button = (label, url) => {
    const {__fragment, __nodes} = __render1$5();
    const __child2 = __nodes[0].childNodes[0];
    const __sub0 = map(url, url => !url, attrBinder(__nodes[0], 'disabled'));
    const __sub1 = map(url, url => () => setUrl.next(url), attrBinder(__nodes[0], 'onclick'));
    textBinder(__child2)(label);
    __fragment.unsubscribe = () => {
      __sub0.unsubscribe();
      __sub1.unsubscribe();
    };
    return __fragment;
  };
  const {__fragment, __nodes} = __render2$2();
  const __child0 = __nodes[0].childNodes[1];
  const __child1 = __nodes[0].childNodes[3];
  const __sub0b = __blockBinder(__child0);
  __sub0b.observer(Button('Previous', previous));
  const __sub1b = __blockBinder(__child1);
  __sub1b.observer(Button('Next', next));
  __fragment.unsubscribe = () => {
    __sub0b.unsubscribe();
    __sub1b.unsubscribe();
  };
  return __fragment;
};
const Spinner = () => {
  return __render3$1().__fragment;
};
const people = people => {
  const {__fragment, __nodes} = __render5$1();
  const __child0 = __nodes[0].childNodes[4];
  const __sub0b = makeOverlay(people);
  propBinder(__sub0b, 'map')(person => {
    const {__fragment, __nodes} = __render4$1();
    const __child0 = __nodes[0].childNodes[0];
    const __child1 = __nodes[1].childNodes[0];
    const __child2 = __nodes[2].childNodes[0];
    const __child3 = __nodes[3].childNodes[0];
    const __child4 = __nodes[4].childNodes[0];
    const __child5 = __nodes[5].childNodes[0];
    const __sub0 = map(person, person => person.name, textBinder(__child0));
    const __sub1 = map(person, person => person.birth_year, textBinder(__child1));
    const __sub2 = map(person, person => person.eye_color, textBinder(__child2));
    const __sub3 = map(person, person => person.hair_color, textBinder(__child3));
    const __sub4 = map(person, person => person.height, textBinder(__child4));
    const __sub5 = map(person, person => person.mass, textBinder(__child5));
    __fragment.unsubscribe = () => {
      __sub0.unsubscribe();
      __sub1.unsubscribe();
      __sub2.unsubscribe();
      __sub3.unsubscribe();
      __sub4.unsubscribe();
      __sub5.unsubscribe();
    };
    return __fragment;
  });
  __sub0b.onanchor(__child0);
  __fragment.unsubscribe = () => {
    __sub0b.unsubscribe();
  };
  return __fragment;
};

const __render0 = renderer(makeTemplate(`
                        <a href="" class="navbar-item" data-bind><text-node></text-node></a>
                    `));
const __render1 = renderer(makeTemplate(`
    <header>
        <nav class="navbar" role="navigation" aria-label="main navigation">
            <div class="navbar-brand">
                <div class="navbar-item">
                    <h6 class="title is-6">Azoth Example Apps</h6>
                </div>
            </div>
            <div class="navbar-menu is-active">
                <div class="navbar-start">
                </div>
                <div class="navbar-end" data-bind>
                    <!-- block -->
                </div>                
            </div>
        </nav>
    </header>
    <main>
        <section class="hero is-primary">
            <div class="hero-body">
            <div class="container">
                <h1 class="title" data-bind><text-node></text-node></h1>
            </div>
            </div>
        </section>
        <section class="container" data-bind>
            <!-- block -->
        </section>
    </main>
`));
const apps = {
  'Hello World': hello,
  'Counter': counter,
  'GitHub Repos': ghRepo,
  'Show HN': showHN,
  'Star Wars': starWars
};
var app = () => {
  const app = Observable.fromEvent(window, 'hashchange').startWith(null).map(() => window.location.hash.slice(1)).map(name => ({
    name: name || 'Hello World',
    app: apps[name] || hello
  }));
  return App(Object.keys(apps), app);
};
const App = (names, __ref0) => {
  const name = __ref0.child('name');
  const app = __ref0.child('app');
  const {__fragment, __nodes} = __render1();
  const __child0 = __nodes[0].childNodes[1];
  const __child1 = __nodes[1].childNodes[0];
  const __child2 = __nodes[2].childNodes[1];
  const __sub0b = __blockBinder(__child0);
  __sub0b.observer(names.map(name => {
    const {__fragment, __nodes} = __render0();
    const __child1 = __nodes[0].childNodes[0];
    attrBinder(__nodes[0], 'href')(`#${name}`);
    textBinder(__child1)(name);
    return __fragment;
  }));
  const __sub1 = name.subscribe(textBinder(__child1));
  const __sub2b = __blockBinder(__child2);
  const __sub2 = app.subscribe(__sub2b.observer);
  __fragment.unsubscribe = () => {
    __sub0b.unsubscribe();
    __sub1.unsubscribe();
    __sub2.unsubscribe();
    __sub2b.unsubscribe();
  };
  return __fragment;
};

document.getElementById('app').appendChild(app());
