import { _, $, Overlay } from 'azoth';
import { Subject } from 'rxjs-es/Subject';
import 'rxjs-es/add/operator/startWith';


const API = 'https://swapi.co/api/people/';
const PER_PAGE = 10;

export default () => {
    const page = new Subject();
    const loading = new Subject();
    const cache = new Map();

    const getPage = url => {
        const search = url.split('?')[1];
        let num = 1;
        if(search) {
            const params = new URLSearchParams(search);
            if(params.has('page')) num = params.get('page');
        }

        if(cache.has(num)) {
            page.next(cache.get(num));
        }
        else {
            loading.next(true);
            fetch(url)
                .then(r => r.json())
                .then(res => {
                    res.pageNumber = num;
                    cache.set(num, res);
                    loading.next(false);
                    page.next(res);
                })
                // TODO: handle this in good way
                .catch(console.log);    
        }
    };

    getPage(API);

    const paging = PagingButtons(page, getPage);

    return Viewer(
        page.startWith({ results: Array(PER_PAGE).fill() }), 
        loading.startWith(true), 
        paging
    );
};

const Viewer = ({ count, pageNumber, results }=$, loading=$, Paging) => {
    return _`
        <header>
            <h3 class="text-center">Page *${pageNumber} of *${Math.ceil(count/PER_PAGE)}</h3>
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

const PagingButtons = ({ previous, next }=$, getPage) => {
    const pagingButton = label => (url=$) => _`
        <button disabled=*${!url} onclick=*${() => getPage(url)}>${label}</button>
    `;
    const PreviousButton = pagingButton('Previous');
    const NextButton = pagingButton('Next');
    
    return _`
        <span>
            ${PreviousButton(previous)}#
            ${NextButton(next)}#
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
    <ul>
        <#:${Overlay(people)} map=${(person=$) => _`<li>*${person.name}</li>`}/>
    </ul>
`;