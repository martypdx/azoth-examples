/* global firebase */
// Why U no rollup :(
// import * as firebase from 'firebase/app';
import { _, $ } from 'diamond-ui';

var config = {
    databaseURL: 'https://hacker-news.firebaseio.com'
};

firebase.initializeApp(config);
const fb = firebase.database().ref( 'v0' );

Object.getPrototypeOf(fb).subscribe = function subscribe(listener) {
    const fn = snapshot => void listener(snapshot.val());
    this.on('value', fn);
    return { unsubscribe: () => void this.off('value', fn) };
};

export default () => {
    const type = 'top';
    return show(fb.child(`${type}stories`));
};

const items = fb.child('item');

const story = key => {
    const ref = items.child(key);
    return item(ref);
};

const item = ({ title, score }=$) => _`
    <li><strong>*${score}</strong>$${title}</li>
`;

const show = (topics=$) => _`
    <h3 class="text-center">Show HN</h3>
    <ul>
        $${topics.map(key => story(key))}#
    </ul>       
`;