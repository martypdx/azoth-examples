import { _, $, Overlay } from 'azoth';
import { Subject } from 'rxjs-es/Subject';
import { Observable } from 'rxjs-es/Observable';
import 'rxjs-es/add/observable/from';
import 'rxjs-es/add/operator/do';
import 'rxjs-es/add/operator/mergeMap';
import 'rxjs-es/add/operator/share';
import 'rxjs-es/add/operator/startWith';


const API = 'https://swapi.co/api/people/';
const PER_PAGE = 10;

const getPageNumber = url => {
    const search = url.split('?')[1];
    return (search && new URLSearchParams(search).get('page')) || '1';
};

const fetchPage = url => fetch(url)
    .then(r => r.json())
    .then(r => (r.pageNumber = getPageNumber(url), r));

export default () => {
    
    const url = new Subject();
    const loading = new Subject();
    const cache = new Map();

    const page = url.startWith(`${API}?page=1`)
        .do(() => loading.next(true))
        .do(url => cache.has(url) || cache.set(url, fetchPage(url)))
        .mergeMap(url => cache.get(url))
        .do(() => loading.next(false))
        .share();

    const paging = PagingButtons(page, url);

    return Viewer(
        page, 
        loading.startWith(true), 
        paging
    );
};

const Viewer = ({ count, pageNumber, results }=$, loading=$, Paging) => {
    return _`
        <header>
            <h3 class="text-center">*${count} Records - Page *${pageNumber} of *${Math.ceil(count/PER_PAGE)}</h3>
        </header>
        <section style="position:relative;">
            *${loading && Spinner}#
            ${people(results)}#
        </section>
        <footer>
            ${Paging}#
        </footer>
    `;
};

const PagingButtons = ({ previous, next }=$, setUrl) => {
    const Button = (label, url=$) => _`
        <button disabled=*${!url} onclick=*${() => setUrl.next(url)}>${label}</button>
    `;

    return _`
        <span>
            ${Button('Previous', previous)}#
            ${Button('Next', next)}#
        </span>
    `;
};

const Spinner = _`
    <div class="fill" style="height: 100%; text-align: center;">
        <img style="height: 100%;" 
            src="https://www.createwebsite.net/wp-content/uploads/2015/09/GD.gif">
    </div>
`;

const people = (people=$) => _`
    <table class="table is-striped is-hoverable is-fullwidth">
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
        <#:${Overlay(people)} map=${(person=$) => _`
            <tr>
                <td>*${person.name}</td>
                <td>*${person.birth_year}</td>
                <td>*${person.eye_color}</td>
                <td>*${person.hair_color}</td>
                <td>*${person.height}</td>
                <td>*${person.mass}</td>
            </tr>`
        }/>
    </table>
`;