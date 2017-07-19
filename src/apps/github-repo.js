import { _, $ } from 'azoth';
import { Observable } from 'rxjs-es/Observable';
import 'rxjs-es/add/observable/from';

const SEARCH = 'https://api.github.com/search/repositories';
const double = 4;

export default () => {
    const req = fetch(`${SEARCH}?q=stars:>5000&sort=stars&per_page=100`)
        .then(r => r.json())
        .then(r => {
            let items = r.items;
            for(let i = 0; i < double; i++) {
                items = items.concat(items);
            }
            return items;
        });
    return repos(Observable.from(req));
};

const repo = ({ html_url: url, full_name: name, stargazers_count: stars, description }) => _`
    <div class="card">
        <a href=${url} target="_blank">${name}</a>
        🌟<strong>${stars}</strong>
        <p>${description}</p>
    </div>
`;

const repos = (repos=$) => _`
    <h3 class="text-center">Found $${repos.length}</h3>
    <div class="list">
        $${(() => {
            console.time('render ' + repos.length);
            const fragments = repos.map(repo);
            console.timeEnd('render ' + repos.length);
            return fragments;
        })()}#
    </div>      
`;