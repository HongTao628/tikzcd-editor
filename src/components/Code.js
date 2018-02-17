import {h, Component} from 'preact'
import classNames from 'classnames'

export default class Code extends Component {

	handleInput = evt => {
		let {onCodeChange = () => {}} = this.props
		onCodeChange();
	}

    render() {
        return <textarea
			id={this.props.id}
			onInput={this.handleInput}
		></textarea>
    }
}
