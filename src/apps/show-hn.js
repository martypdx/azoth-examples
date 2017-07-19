/* global firebase */
// Why U no rollup :(
// import * as firebase from 'firebase/app';
import { _, $ } from 'azoth';

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
    return card(ref);
};

const comment = key => {
    const ref = items.child(key);
    return note(ref);
};

const byline = ({ type, by }) => _`
    <p>$${type} by <em>$${by}</em></p>
`;

const note = (reply=$) => _`
    <div>
        <div>$${reply ? reply.text : null}</div>
        ${byline(reply)}#
    </div>
`;

const card = (item=$) => _`
    <li>
        <div class="card">
            <a href=$${item.url} target="_blank">$${item.title}</a>
            🌟<strong>$${item.score}</strong>
            ${byline(item)}#
            $${ item.kids ? item.kids.length : 0 } comments
            <ul>
            $${
                item.kids ? item.kids.map(kid => comment(kid)) : []
            }#
            </ul>
        </div>
    </li>
`;

const show = (topics=$) => _`
    <h3 class="text-center">Show HN</h3>
    <h2>*${topics.length} stories</h2>
    <ul>
        $${(() =>{
            console.time('shn render');
            const mapped = topics.map(key => story(key));
            console.timeEnd('shn render');
            return mapped;
        })()}#
    </ul>       
`;