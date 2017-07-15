/* global firebase */
// Why U no rollup :(
// import * as firebase from 'firebase/app';
import { Observable } from 'rxjs-es/Observable';
import 'rxjs-es/add/operator/pluck';

Observable.prototype.child = Observable.prototype.pluck;

var config = {
    databaseURL: 'https://hacker-news.firebaseio.com'
};

firebase.initializeApp(config);
export const fb = firebase.database().ref( 'v0' );

Object.getPrototypeOf(fb).subscribe = function subscribe(listener) {
    const fn = snapshot => void listener(snapshot.val());
    this.on('value', fn);
    return { unsubscribe: () => void this.off('value', fn) };
};