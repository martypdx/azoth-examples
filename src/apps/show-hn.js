/* global firebase */
import { _, $ } from 'diamond-ui';
// Why U no rollup :(
// import * as firebase from 'firebase/app';


var config = {
    databaseURL: 'https://hacker-news.firebaseio.com'
};
// wat
firebase.initializeApp(config);
const fb = firebase.database().ref( 'v0' );
const items = fb.child('item');
// items.child('14726528').on('value', snapshot => {
//     console.log(snapshot.val());
// });

const fbObservable = ref => {
    return {
        child(name) {
            return fbObservable(ref.child(name));
        },
        subscribe(listener) {
            const fn = snapshot => void listener(snapshot.val());

            ref.on('value', fn);

            return {
                unsubscribe() {
                    ref.off('value', fn);
                }
            };
        }
    };
};

export default () => {
    const type = 'top';
    const observable = fbObservable(fb.child(`${type}stories`));
    return show(observable);
};

const story = key => {
    const ref = fbObservable(items.child(key));
    return item(ref);
};

const item = ({ title, score }=$) => _`
    <li><strong>*${score}</strong>${title}</li>
`;

const show = (topics=$) => _`
    <h3 class="text-center">Show HN</h3>
    <ul>
        ${topics.map(key => story(key))}#
    </ul>       
`;