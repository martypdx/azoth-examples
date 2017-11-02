/* global firebase */
// Why U no rollup :(
// import * as firebase from 'firebase/app';
import { _, $, rawHtml } from 'azoth';
import { Observable } from 'rxjs-es/Observable';
import 'rxjs-es/add/observable/from';

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
    return Show(fb.child(`${type}stories`));
};

const Show = (topics=$) => _`
    <h3 class="text-center">Show HN</h3>
    <h2>*${topics.length} stories</h2>
    <ul>
        $${(() =>{
            console.log('topics', topics.length);
            console.time('shn render');
            const mapped = topics.map(key => story(key));
            console.timeEnd('shn render');
            return mapped;
        })()}#
    </ul>       
`;

const items = fb.child('item');

const story = key => {
    const ref = items.child(key);
    return Card(ref);
};

const comments = keys => {
    if(!keys) return null;
    const replies = Observable.from(
        Promise.resolve(keys.map(key => items.child(key)))
    );
    const notes = (replies=$) => _`
        $${replies.map(Reply)}#
    `; 
    return notes(replies);
};

const Byline = ({ type, by }) => _`
    <p>${type} by <em>${by}</em></p>
`;

const Reply = (reply=$) => _`
    <div>
        <div>$${reply ? reply.text : null}</div>
        $${Byline(reply)}#
    </div>
`;

const Card = (item=$) => _`
    <li>
        <div class="card">
            <a href=$${item.url} target="_blank">$${item.title}</a>
            🌟<strong>$${item.score}</strong>
            $${Byline(item)}#
            $${ item.kids ? item.kids.length : 0 } comments
            <ul>
            $${/*comments(item.kids)*/_`'comments'`}#
            </ul>
        </div>
    </li>
`;
