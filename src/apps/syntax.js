import { _, $ } from 'azoth';
import { Stream } from 'azoth/blocks';

export default (data=$, colors=$) => _`
    <div>
        !${'Data gave error'}#
        ^${(data && colors, _`<span>Loading...</span>`)`}#
        
    </div>
    <div>
        *#${colors.map(color => _`
            <button class=${`btn-${color}`}>${color}</button>
        `)}
    </div>

    <ul>
        <#:${Stream(data)} chunk=${100}
            map=${({ name, type }) => _`
                <li>${name} then ${type}</li>
            `}
        />
    </ul>
`;